import { DOMReader } from "./dom-reader";
import { DOMWriter } from "./dom-writer";
import { DOMObserver } from "./dom-observer";
import { PasswordEngine } from "./password-engine";
import { BudgetTracker } from "./solver/budget";
import { RuleClassifier } from "./rule-classifier";
import { NumericSolver, parseNumericConstraint } from "./handlers/numeric";
import { ConflictResolver } from "./conflict-resolver";
import { Handler, ClassifiedRule } from "../shared/types";
import { digitSum as digitSumFn, stripHtml } from "../shared/unicode";
import { HumanHandler } from "./handlers/human";

export class MainLoop {
  private running = false;
  private paused = false;
  private knownRules: Map<number, ClassifiedRule> = new Map();
  private tickLock = false; 

  constructor(
    private domReader: DOMReader,
    private domWriter: DOMWriter,
    private domObserver: DOMObserver,
    private engine: PasswordEngine,
    private budget: BudgetTracker,
    private classifier: RuleClassifier,
    private numericSolver: NumericSolver,
    private conflictResolver: ConflictResolver,
    private handlers: Map<string, Handler>,
    private humanHandler: HumanHandler
  ) {}

  async start(): Promise<void> {
    this.running = true;
    this.log("Initializing...");

    const strategy = await this.domWriter.detectStrategy();
    this.log(`Write strategy: ${strategy}`);

    this.engine.setZone("base", "strongpasswordA!", 10, []);
    this.domWriter.typePassword(this.formatPassword(this.engine.getPassword()));

    this.domObserver.onRulesChanged(() => this.scheduleTick());

    setInterval(() => this.scheduleTick(), 5000);

    await this.domObserver.waitForStability();
    await this.tick();

    this.log("Solver running");
  }

  private scheduleTick(): void {
    if (this.tickLock || this.paused || !this.running) return;
    queueMicrotask(() => this.tick());
  }

  private async tick(): Promise<void> {
    if (this.tickLock) return;
    this.tickLock = true;

    try {
      await this.domObserver.waitForStability(200, 3000);

      const rules = this.domReader.readRules();
      this.log(`Tick: seeing ${rules.length} total rules. Known rules: ${this.knownRules.size}`);

      let passwordChanged = false;
      for (const rule of rules) {
        if (this.knownRules.has(rule.number)) continue;

        rule.category = this.classifier.classify(rule.text);
        this.knownRules.set(rule.number, rule);
        this.log(`New rule #${rule.number} [${rule.category}]: ${rule.text}`);

        if (rule.category === "human") {
          this.log(`🔤 Attempting auto-solve for CAPTCHA rule #${rule.number}`);

          // The spy may have ALREADY captured the CAPTCHA from a previous validation pass.
          // Check immediately before doing anything else.
          let captcha = (window as any).__pwgCaptchaAnswer as string | null;
          
          if (!captcha) {
            // Not yet captured — type the password to trigger a validation cycle
            this.domWriter.typePassword(this.formatPassword(this.engine.getPassword()));
            await this.domObserver.waitForStability(200, 2000);
            
            // Wait for the spy to catch the CAPTCHA from the includes() check
            captcha = await this.waitForCaptcha(3000);
          }

          if (captcha) {
            this.log(`🔤 CAPTCHA auto-solved: "${captcha}"`);
            this.engine.setZone(`human_${rule.number}`, captcha, 90 + rule.number, [rule.number]);
            this.engine.lockZone(`human_${rule.number}`);
          } else {
            // Fall back to manual input
            this.paused = true;
            this.log(`⏸ CAPTCHA not detected by spy, falling back to human input on rule #${rule.number}`);
            const input = await this.requestHumanInput(rule, `CAPTCHA required for rule #${rule.number}: ${rule.text}`);
            this.engine.setZone(`human_${rule.number}`, input, 90 + rule.number, [rule.number]);
            this.engine.lockZone(`human_${rule.number}`);
            this.paused = false;
          }

          const newBudget = this.budget.compute(this.engine);
          this.log(`Post-CAPTCHA budget: len=${newBudget.totalLength}, digitSum=${newBudget.digitSumFromOtherZones}, romanPollution=${newBudget.romanValueFromOtherZones}`);

          for (const [category, handler] of Array.from(this.handlers.entries())) {
            if (category === "human") continue;
            const rulesInCategory = [...this.knownRules.values()].filter(r => r.category === category);
            for (const r of rulesInCategory) {
              if (this.engine.getZone(r.zoneId || "")?.locked) continue;
              const update = await handler.solve(r, this.engine, this.budget);
              this.engine.setZone(update.zone, update.content, update.priority, [r.number]);
            }
          }

          this.resolveAllNumeric();
          passwordChanged = true;

        } else if (rule.category === "numeric") {
          this.resolveAllNumeric();
          passwordChanged = true;
        } else {
          const handler = this.handlers.get(rule.category);
          if (handler) {
            const update = await handler.solve(rule, this.engine, this.budget);
            this.engine.setZone(update.zone, update.content, update.priority, [rule.number]);
            passwordChanged = true;
          }
        }
      }

      if (passwordChanged) {
        // Re-resolve numeric rules to account for digit pollution from new zones (e.g. leap year "2000")
        this.resolveAllNumeric();
        this.domWriter.typePassword(this.formatPassword(this.engine.getPassword()));
        this.log(`Attempted to type: ${this.engine.getPassword()}`);
        await this.domObserver.waitForStability();
        this.log(`Actual text in editor AFTER typing: ${this.domWriter.getCurrentEditorText()}`);
      }

      const updatedRules = this.domReader.readRules();
      const broken = updatedRules.filter(r => !r.satisfied && this.knownRules.has(r.number));

      if (broken.length > 0) {
        this.log(`Broken: ${broken.map(r => `#${r.number}`).join(", ")}`);
        await this.conflictResolver.resolve(broken, this.knownRules, this.engine, this.budget);
        this.domWriter.typePassword(this.formatPassword(this.engine.getPassword()));
        await this.domObserver.waitForStability();
      }

      if (this.domReader.checkWin()) {
        this.log("🏆 GAME WON!");
        this.running = false;
      }

    } catch (err) {
      this.log(`Tick error: ${err}`, "error");
    } finally {
      this.tickLock = false;
    }
  }

  private resolveAllNumeric(): void {
    const numericRules = [...this.knownRules.values()].filter(r => r.category === "numeric");
    if (numericRules.length === 0) return;

    this.log(`Resolving numeric rules: ${numericRules.map(r => r.text).join(" | ")}`);

    // --- Dynamic digit overflow compensation ---
    const digitSumConstraint = numericRules.find(r => {
      const t = r.text.toLowerCase();
      return /digits/i.test(t) && /add\s+up/i.test(t);
    });
    if (digitSumConstraint) {
      const targetMatch = digitSumConstraint.text.match(/add\s+up\s+to\s*(\d+)/i);
      const target = targetMatch ? parseInt(targetMatch[1]) : 0;
      if (target > 0) {
        this.compensateDigitOverflow(target);
      }
    }

    const currentBudget = this.budget.compute(this.engine);
    this.log(`Current Budget: DigitsSum=${currentBudget.digitSumFromOtherZones}`);

    const constraints = numericRules.map(r => parseNumericConstraint(r));
    this.log(`Constraints: ${JSON.stringify(constraints)}`);

    const solution = this.numericSolver.solveAll(
      constraints,
      this.engine,
      currentBudget
    );

    if (solution) {
      this.log(`Solution applied: digits=${solution.digits}, roman=${solution.roman}, elements=${solution.elements}`);
      if (solution.digits !== undefined) this.engine.setZone("digits", solution.digits, 40, []);
      if (solution.roman !== undefined) this.engine.setZone("roman", solution.roman, 50, []);
      if (solution.elements !== undefined) this.engine.setZone("elements", solution.elements, 60, []);
      this.log(`New password: ${this.engine.getPassword()}`);
    } else {
      this.log("Numeric solver failed — flagging to user", "error");
    }
  }

  /**
   * When locked zones contribute too many digits, dynamically adjust
   * the base password and leap year to minimize digit pollution.
   */
  private compensateDigitOverflow(target: number): void {
    // Compute digit sum from all zones EXCEPT digits zone
    const zones = this.engine.getAllZones();
    let otherSum = 0;
    for (const [name, zone] of zones) {
      if (name !== "digits") {
        otherSum += digitSumFn(stripHtml(zone.content));
      }
    }

    if (otherSum <= target) return; // No overflow, nothing to do

    const overflow = otherSum - target;
    this.log(`⚠️ Digit overflow detected: otherZones=${otherSum}, target=${target}, overflow=${overflow}`);

    // Step 1: Remove digit from base if present
    const baseZone = this.engine.getZone("base");
    if (baseZone && !baseZone.locked) {
      const baseContent = baseZone.content;
      const baseDigitSum = digitSumFn(baseContent);
      if (baseDigitSum > 0) {
        const newBase = baseContent.replace(/\d/g, "");
        this.engine.setZone("base", newBase, baseZone.priority, baseZone.ruleDependencies);
        this.log(`  → Removed digits from base: "${baseContent}" → "${newBase}" (saved ${baseDigitSum})`);
        otherSum -= baseDigitSum;
        if (otherSum <= target) return;
      }
    }

    // Step 2: Try different leap years with lower digit sums
    const leapZone = this.engine.getZone("leapyear");
    if (leapZone && !leapZone.locked) {
      const currentLeap = leapZone.content;
      const currentLeapDigitSum = digitSumFn(currentLeap);
      
      // Find best leap year: need otherSum - currentLeapDigitSum + newLeapDigitSum <= target
      // i.e., newLeapDigitSum <= target - (otherSum - currentLeapDigitSum)
      const maxAllowed = target - (otherSum - currentLeapDigitSum);
      
      // Candidate leap years sorted by digit sum (ascending)
      const candidates = [
        { year: "10000", sum: 1 },  // 1+0+0+0+0 = 1, divisible by 400
        { year: "2000", sum: 2 },   // 2+0+0+0 = 2
        { year: "1200", sum: 3 },   // 1+2+0+0 = 3
        { year: "4", sum: 4 },      // 4
        { year: "400", sum: 4 },    // 4+0+0 = 4
        { year: "2004", sum: 6 },   // 2+0+0+4 = 6
        { year: "2400", sum: 6 },   // 2+4+0+0 = 6
        { year: "1600", sum: 7 },   // 1+6+0+0 = 7
        { year: "800", sum: 8 },    // 8+0+0 = 8
        { year: "2008", sum: 10 },  // 2+0+0+8 = 10
      ];

      for (const c of candidates) {
        if (c.sum <= maxAllowed && c.year !== currentLeap) {
          this.engine.setZone("leapyear", c.year, leapZone.priority, leapZone.ruleDependencies);
          this.log(`  → Swapped leap year: "${currentLeap}" → "${c.year}" (digitSum ${currentLeapDigitSum} → ${c.sum})`);
          break;
        }
      }
    }
  }

  private async waitForCaptcha(timeoutMs: number): Promise<string | null> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const captcha = (window as any).__pwgCaptchaAnswer;
      if (captcha && typeof captcha === 'string' && captcha.length >= 3) {
        return captcha;
      }
      await new Promise(r => setTimeout(r, 300));
    }
    return null;
  }

  private async requestHumanInput(rule: ClassifiedRule, prompt: string): Promise<string> {
    return this.humanHandler.requestInput(rule, prompt);
  }

  private formatPassword(password: string): string {
    if (this.knownRules.has(19)) {
      return password.replace(/(<[^>]*>)|([aeiouyAEIOUY])/g, (match, tag, vowel) => {
        return tag ? tag : `<strong>${vowel}</strong>`;
      });
    }
    return password;
  }

  private log(msg: string, level: "info" | "warn" | "error" = "info"): void {
    const prefix = `[PWG ${new Date().toLocaleTimeString()}]`;
    level === "error" ? console.error(`${prefix} ${msg}`) : console.log(`${prefix} ${msg}`);
    
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ type: "LOG", msg, level }).catch(() => {
        // If message fails, context might be dead, stop the loop
        this.running = false;
      });
    } else if (typeof chrome !== "undefined" && (!chrome.runtime || !chrome.runtime.id)) {
      // Context definitely invalidated, stop
      this.running = false;
    }
  }
}
