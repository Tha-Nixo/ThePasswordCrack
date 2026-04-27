import { DOMReader } from "./dom-reader";
import { DOMWriter } from "./dom-writer";
import { DOMObserver } from "./dom-observer";
import { PasswordEngine } from "./password-engine";
import { BudgetTracker } from "./solver/budget";
import { RuleClassifier } from "./rule-classifier";
import { NumericSolver, parseNumericConstraint } from "./handlers/numeric";
import { ConflictResolver } from "./conflict-resolver";
import { Handler, ClassifiedRule, HumanInputRequest } from "../shared/types";
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

    this.engine.setZone("base", "Helicopter1!", 10, []);
    this.domWriter.typePassword(this.engine.getPassword());

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
          this.paused = true;
          this.log(`⏸ Waiting for human input on rule #${rule.number}`);
          const input = await this.requestHumanInput(rule, `Human input required for rule #${rule.number}: ${rule.text}`);
          this.engine.setZone(`human_${rule.number}`, input, 90 + rule.number, [rule.number]);
          this.engine.lockZone(`human_${rule.number}`);

          const newBudget = this.budget.compute(this.engine);
          this.log(`Post-human budget: len=${newBudget.totalLength}, digitSum=${newBudget.digitSumFromOtherZones}, romanPollution=${newBudget.romanValueFromOtherZones}`);

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
          this.paused = false;

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
        this.domWriter.typePassword(this.engine.getPassword());
        this.log(`Attempted to type: ${this.engine.getPassword()}`);
        await this.domObserver.waitForStability();
        this.log(`Actual text in editor AFTER typing: ${this.domWriter.getCurrentEditorText()}`);
      }

      const updatedRules = this.domReader.readRules();
      const broken = updatedRules.filter(r => !r.satisfied && this.knownRules.has(r.number));

      if (broken.length > 0) {
        this.log(`Broken: ${broken.map(r => `#${r.number}`).join(", ")}`);
        await this.conflictResolver.resolve(broken, this.knownRules, this.engine, this.budget);
        this.domWriter.typePassword(this.engine.getPassword());
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

  private async requestHumanInput(rule: ClassifiedRule, prompt: string): Promise<string> {
    return this.humanHandler.requestInput(rule, prompt);
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
