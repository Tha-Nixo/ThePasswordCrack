"use strict";
(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };

  // src/content/dom-reader.ts
  var DOMReader;
  var init_dom_reader = __esm({
    "src/content/dom-reader.ts"() {
      "use strict";
      DOMReader = class {
        /**
         * Reads all rules from the game DOM
         */
        readRules() {
          const ruleElements = document.querySelectorAll(".rule");
          const rules = [];
          for (const el of ruleElements) {
            const topEl = el.querySelector(".rule-top");
            const descEl = el.querySelector(".rule-desc");
            const headerText = topEl?.textContent || "";
            const descText = descEl?.textContent || "";
            const fullText = `${headerText} ${descText}`.trim();
            const ruleNumberMatch = headerText.match(/Rule\s*(\d+)/i);
            const ruleNumber = ruleNumberMatch ? parseInt(ruleNumberMatch[1]) : this.hashCode(fullText);
            rules.push({
              number: ruleNumber,
              text: descText,
              // Pass only the description to solvers to avoid Rule N number collision
              satisfied: this.isRuleSatisfied(el),
              category: "unknown"
            });
          }
          return rules;
        }
        hashCode(s) {
          let hash = 0;
          for (let i = 0; i < s.length; i++) {
            const char = s.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash;
          }
          return Math.abs(hash);
        }
        checkWin() {
          return document.querySelector(".win-screen") !== null || document.body.textContent?.includes("You won") || false;
        }
        isRuleSatisfied(el) {
          const isError = el.classList.contains("rule-error");
          const icon = el.querySelector(".rule-icon");
          const isCheckmark = icon?.src?.includes("checkmark.svg");
          return !isError && isCheckmark;
        }
      };
    }
  });

  // src/content/dom-writer.ts
  var DOMWriter;
  var init_dom_writer = __esm({
    "src/content/dom-writer.ts"() {
      "use strict";
      DOMWriter = class {
        editor = null;
        activeStrategy = null;
        async detectStrategy() {
          const editor = this.findEditor();
          const strategies = [
            { name: "execCommand", fn: (t) => this.writeViaExecCommand(t) },
            { name: "inputEvent", fn: (t) => this.writeViaInputEvent(t) },
            { name: "pmDirect", fn: (t) => this.writeViaProseMirrorView(t) },
            { name: "pmHack", fn: (t) => this.writeViaProseMirrorHack(t) }
          ];
          for (const strategy of strategies) {
            console.log(`[PWG] Testing strategy: ${strategy.name}`);
            const before = this.takeSnapshot();
            try {
              strategy.fn("PWG_TEST_123!");
            } catch (e) {
              console.log(`[PWG] Strategy ${strategy.name} threw: ${e}`);
              continue;
            }
            await this.waitForDOMStability(500);
            const after = this.takeSnapshot();
            if (this.snapshotsDiffer(before, after)) {
              console.log(`[PWG] \u2713 Strategy '${strategy.name}' works (snapshot diff detected)`);
              this.activeStrategy = strategy.name;
              try {
                strategy.fn("");
              } catch {
              }
              await this.waitForDOMStability(300);
              return strategy.name;
            }
            console.log(`[PWG] \u2717 Strategy '${strategy.name}' \u2014 no snapshot change`);
            try {
              strategy.fn(before.passwordContent);
            } catch {
            }
            await this.waitForDOMStability(300);
          }
          throw new Error(
            "[PWG] FATAL: No write strategy produced a detectable state change. See README troubleshooting section."
          );
        }
        typePassword(text) {
          if (!this.activeStrategy) {
            throw new Error("[PWG] Call detectStrategy() before typePassword()");
          }
          switch (this.activeStrategy) {
            case "execCommand":
              this.writeViaExecCommand(text);
              break;
            case "inputEvent":
              this.writeViaInputEvent(text);
              break;
            case "pmDirect":
              this.writeViaProseMirrorView(text);
              break;
            case "pmHack":
              this.writeViaProseMirrorHack(text);
              break;
          }
        }
        findEditor() {
          if (this.editor) return this.editor;
          const el = document.querySelector("[contenteditable='true']");
          if (!el) throw new Error("Could not find ProseMirror editor element");
          this.editor = el;
          return el;
        }
        getCurrentEditorText() {
          try {
            const editor = this.findEditor();
            return editor.textContent || "";
          } catch {
            return "";
          }
        }
        writeViaExecCommand(text) {
          const editor = this.findEditor();
          editor.focus();
          document.execCommand("selectAll", false);
          document.execCommand("insertText", false, text);
        }
        writeViaInputEvent(text) {
          const editor = this.findEditor();
          editor.focus();
          const selection = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(editor);
          selection.removeAllRanges();
          selection.addRange(range);
          editor.dispatchEvent(new InputEvent("beforeinput", {
            inputType: "deleteContentBackward",
            bubbles: true,
            cancelable: true,
            composed: true
          }));
          editor.dispatchEvent(new InputEvent("beforeinput", {
            inputType: "insertText",
            data: text,
            bubbles: true,
            cancelable: true,
            composed: true
          }));
          editor.dispatchEvent(new InputEvent("input", {
            inputType: "insertText",
            data: text,
            bubbles: true
          }));
        }
        writeViaProseMirrorView(text) {
          const view = this.findPMView();
          if (!view) throw new Error("ProseMirror view not found");
          const { state } = view;
          const tr = state.tr;
          tr.replaceWith(0, state.doc.content.size, state.schema.text(text));
          view.dispatch(tr);
        }
        writeViaProseMirrorHack(text) {
          const editor = this.findEditor();
          const viewPaths = [
            editor.pmViewDesc?.view,
            editor.__view,
            editor._view,
            editor.parentElement?.pmViewDesc?.view,
            editor.parentElement?.__view
          ];
          const candidates = [...viewPaths];
          for (const key of Object.getOwnPropertyNames(editor)) {
            const val = editor[key];
            if (val && typeof val === "object" && val.state && val.dispatch && val.state.doc) {
              candidates.push(val);
            }
          }
          const view = candidates.find((v) => v && v.state && v.dispatch);
          if (!view) throw new Error("Could not find ProseMirror view via hack");
          const { state } = view;
          const tr = state.tr;
          tr.replaceWith(0, state.doc.content.size, state.schema.text(text));
          view.dispatch(tr);
        }
        findPMView() {
          const editor = this.findEditor();
          return editor.pmViewDesc?.view || editor.__view;
        }
        waitForDOMStability(ms) {
          return new Promise((resolve) => setTimeout(resolve, ms));
        }
        takeSnapshot() {
          const rules = document.querySelectorAll("[class*='rule']");
          const satisfied = /* @__PURE__ */ new Set();
          let idx = 0;
          for (const rule of rules) {
            if (this.isRuleSatisfied(rule)) {
              satisfied.add(idx);
            }
            idx++;
          }
          const editor = this.findEditor();
          return {
            ruleCount: rules.length,
            satisfiedRules: satisfied,
            passwordContent: editor.textContent || ""
          };
        }
        snapshotsDiffer(before, after) {
          if (before.passwordContent === after.passwordContent) return false;
          if (before.satisfiedRules.size !== after.satisfiedRules.size) return true;
          for (const idx of after.satisfiedRules) {
            if (!before.satisfiedRules.has(idx)) return true;
          }
          for (const idx of before.satisfiedRules) {
            if (!after.satisfiedRules.has(idx)) return true;
          }
          if (before.ruleCount !== after.ruleCount) return true;
          return false;
        }
        isRuleSatisfied(ruleEl) {
          return ruleEl.classList.contains("satisfied") || ruleEl.classList.contains("completed") || ruleEl.querySelector("[class*='check'], [class*='satisfied']") !== null;
        }
      };
    }
  });

  // src/content/dom-observer.ts
  var DOMObserver;
  var init_dom_observer = __esm({
    "src/content/dom-observer.ts"() {
      "use strict";
      DOMObserver = class {
        ruleObserver = null;
        pollTimer = null;
        lastKnownState = "";
        onRulesChanged(callback) {
          const debouncedCallback = this.debounce(callback, 150);
          const ruleContainer = this.findRuleContainer();
          if (ruleContainer) {
            this.ruleObserver = new MutationObserver(() => debouncedCallback());
            this.ruleObserver.observe(ruleContainer, {
              childList: true,
              subtree: true,
              attributes: true,
              characterData: true
            });
          }
          const bodyObserver = new MutationObserver((mutations) => {
            const structural = mutations.some(
              (m) => m.type === "childList" && m.addedNodes.length > 0
            );
            if (structural) debouncedCallback();
          });
          bodyObserver.observe(document.body, { childList: true, subtree: false });
          this.pollTimer = window.setInterval(() => {
            const currentState = this.computeStateHash();
            if (currentState !== this.lastKnownState) {
              this.lastKnownState = currentState;
              debouncedCallback();
            }
          }, 3e3);
        }
        computeStateHash() {
          const rules = document.querySelectorAll("[class*='rule']");
          const parts = [];
          for (const rule of rules) {
            parts.push(`${rule.textContent?.slice(0, 50)}|${rule.className}`);
          }
          return `${rules.length}:${parts.join("||")}`;
        }
        async waitForStability(quietMs = 200, timeoutMs = 3e3) {
          return new Promise((resolve) => {
            let timer = null;
            let timeout = null;
            let lastHash = this.computeStateHash();
            let obs = null;
            const cleanup = () => {
              if (timer) clearTimeout(timer);
              if (timeout) clearTimeout(timeout);
              if (obs) obs.disconnect();
            };
            const checkStable = () => {
              const currentHash = this.computeStateHash();
              if (currentHash === lastHash) {
                cleanup();
                resolve();
              } else {
                lastHash = currentHash;
                if (timer) clearTimeout(timer);
                timer = window.setTimeout(checkStable, quietMs);
              }
            };
            timeout = window.setTimeout(() => {
              cleanup();
              resolve();
            }, timeoutMs);
            obs = new MutationObserver(() => {
              if (timer) clearTimeout(timer);
              timer = window.setTimeout(checkStable, quietMs);
            });
            const target = this.findRuleContainer() || document.body;
            obs.observe(target, {
              childList: true,
              subtree: true,
              attributes: true,
              characterData: true
            });
            timer = window.setTimeout(checkStable, quietMs);
          });
        }
        debounce(fn, ms) {
          let timer = 0;
          return () => {
            clearTimeout(timer);
            timer = window.setTimeout(fn, ms);
          };
        }
        findRuleContainer() {
          return document.querySelector("[class*='rules'], [class*='rule-list']");
        }
        destroy() {
          this.ruleObserver?.disconnect();
          if (this.pollTimer) clearInterval(this.pollTimer);
        }
      };
    }
  });

  // src/content/password-engine.ts
  var PasswordEngine;
  var init_password_engine = __esm({
    "src/content/password-engine.ts"() {
      "use strict";
      PasswordEngine = class {
        zones = /* @__PURE__ */ new Map();
        /**
         * Complete password built by concatenating all zones,
         * sorted by their insertion order or a designated priority.
         * For simplicity here, we can sort by priority to ensure stable ordering.
         */
        getPassword() {
          const sortedZones = Array.from(this.zones.entries()).map(([name, zone]) => ({ name, ...zone })).sort((a, b) => a.priority - b.priority);
          return sortedZones.map((z) => z.content).join("");
        }
        getPasswordExcludingZone(excludeZoneName) {
          const sortedZones = Array.from(this.zones.entries()).map(([name, zone]) => ({ name, ...zone })).sort((a, b) => a.priority - b.priority);
          return sortedZones.filter((z) => z.name !== excludeZoneName).map((z) => z.content).join("");
        }
        setZoneContent(name, content) {
          const zone = this.zones.get(name);
          if (zone && !zone.locked) {
            zone.content = content;
          }
        }
        setZone(name, content, priority, ruleDependencies) {
          const existing = this.zones.get(name);
          if (existing && existing.locked) return;
          this.zones.set(name, {
            content,
            locked: false,
            priority,
            ruleDependencies
          });
        }
        getZone(name) {
          return this.zones.get(name);
        }
        getAllZones() {
          return this.zones;
        }
        lockZone(name) {
          const zone = this.zones.get(name);
          if (zone) zone.locked = true;
        }
      };
    }
  });

  // src/shared/unicode.ts
  function charCount(s) {
    if (typeof Intl !== "undefined" && Intl.Segmenter) {
      const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
      return [...segmenter.segment(s)].length;
    }
    return Array.from(s).length;
  }
  function digitCount(s) {
    return Array.from(s).filter((c) => /^\d$/.test(c)).length;
  }
  function uppercaseCount(s) {
    return Array.from(s).filter((c) => c !== c.toLowerCase() && c === c.toUpperCase()).length;
  }
  function lowercaseCount(s) {
    return Array.from(s).filter((c) => c !== c.toUpperCase() && c === c.toLowerCase()).length;
  }
  function digitSum(s) {
    return Array.from(s).filter((c) => /^\d$/.test(c)).reduce((sum, d) => sum + parseInt(d), 0);
  }
  function romanChars(s) {
    return Array.from(s).filter((c) => "IVXLCDM".includes(c)).join("");
  }
  var init_unicode = __esm({
    "src/shared/unicode.ts"() {
      "use strict";
    }
  });

  // src/content/solver/budget.ts
  var RomanParser, BudgetTracker;
  var init_budget = __esm({
    "src/content/solver/budget.ts"() {
      "use strict";
      init_unicode();
      RomanParser = class {
        strategy = "contiguous";
        // Default, update after testing
        /**
         * Extract roman numeral value from a string based on the game's parsing rules.
         */
        parseRomanValue(s, strategy) {
          const strat = strategy || this.strategy;
          switch (strat) {
            case "all_chars":
              return this.evalRoman(romanChars(s));
            case "contiguous":
              const matches = s.match(/[IVXLCDM]{2,}/g) || [];
              return matches.reduce((sum, m) => sum + this.evalRoman(m), 0);
            case "maximal_munch":
              return this.findAllRomanSubstrings(s).reduce((sum, val) => sum + val, 0);
          }
        }
        evalRoman(s) {
          const vals = { M: 1e3, D: 500, C: 100, L: 50, X: 10, V: 5, I: 1 };
          let total = 0;
          for (let i = 0; i < s.length; i++) {
            const curr = vals[s[i]] || 0;
            const next = vals[s[i + 1]] || 0;
            total += curr < next ? -curr : curr;
          }
          return total;
        }
        findAllRomanSubstrings(s) {
          const matches = s.match(/[IVXLCDM]+/g) || [];
          return matches.map((m) => this.evalRoman(m));
        }
      };
      BudgetTracker = class {
        romanParser = new RomanParser();
        compute(engine) {
          const password = engine.getPassword();
          const zones = engine.getAllZones();
          const budget = {
            totalLength: charCount(password),
            totalCodeUnits: password.length,
            digitCount: digitCount(password),
            uppercaseCount: uppercaseCount(password),
            lowercaseCount: lowercaseCount(password),
            specialCount: charCount(password.replace(/[a-zA-Z0-9]/g, "")),
            romanCharCount: charCount(romanChars(password)),
            romanValueFromOtherZones: 0,
            digitSumFromOtherZones: 0
          };
          for (const [name, zone] of zones) {
            if (name !== "roman") {
              budget.romanValueFromOtherZones += this.romanParser.parseRomanValue(zone.content);
            }
            if (name !== "digits") {
              budget.digitSumFromOtherZones += digitSum(zone.content);
            }
          }
          return budget;
        }
        checkProposal(engine, zoneName, newContent, globalConstraints) {
          const oldContent = engine.getZone(zoneName)?.content || "";
          engine.setZoneContent(zoneName, newContent);
          const budget = this.compute(engine);
          const violations = [];
          for (const constraint of globalConstraints) {
            if (!constraint.check(budget)) {
              violations.push({
                constraint: constraint.name,
                message: constraint.describe(budget)
              });
            }
          }
          engine.setZoneContent(zoneName, oldContent);
          return violations;
        }
      };
    }
  });

  // src/content/rule-classifier.ts
  var RuleClassifier;
  var init_rule_classifier = __esm({
    "src/content/rule-classifier.ts"() {
      "use strict";
      RuleClassifier = class {
        classify(text) {
          const t = text.toLowerCase();
          if (/digits/i.test(t) && /add\s+up/i.test(t) || /roman/i.test(t) || /atomic/i.test(t)) {
            return "numeric";
          }
          if (/wordle/i.test(t) || /youtube/i.test(t) || /country/i.test(t)) {
            return "external";
          }
          if (/captcha/i.test(t) || /chess/i.test(t) || /maps/i.test(t) || /geoguessr/i.test(t)) {
            return "human";
          }
          if (/month/i.test(t)) {
            return "pattern";
          }
          if (/time/i.test(t)) {
            return "time";
          }
          if (/at\s+least/i.test(t) || /include/i.test(t) || /special\s+character/i.test(t)) {
            return "text";
          }
          return "text";
        }
      };
    }
  });

  // src/content/handlers/numeric.ts
  function parseNumericConstraint(rule) {
    const t = rule.text.toLowerCase();
    if (/digits/i.test(t) && /add\s+up/i.test(t)) {
      const match = t.match(/add\s+up\s+to\s*(\d+)/i);
      return { type: "sum", target: match ? parseInt(match[1]) : 0 };
    }
    if (/roman/i.test(t)) {
      if (/multiply/i.test(t)) {
        const match = t.match(/(?:to|up\s+to)\s*(\d+)/i) || t.match(/(\d+)/);
        return { type: "roman_multiply", target: match ? parseInt(match[1]) : 0 };
      }
      if (/sum/i.test(t)) {
        const match = t.match(/(?:to|up\s+to)\s*(\d+)/i) || t.match(/(\d+)/);
        return { type: "sum", target: match ? parseInt(match[1]) : 0 };
      }
      return { type: "roman_presence" };
    }
    if (/atomic/i.test(t) && /add\s+up/i.test(t)) {
      const match = t.match(/add\s+up\s+to\s*(\d+)/i);
      return { type: "sum", target: match ? parseInt(match[1]) : 0 };
    }
    return { type: "ratio", maxRatio: 0.3 };
  }
  var NumericSolver, NumericHandler;
  var init_numeric = __esm({
    "src/content/handlers/numeric.ts"() {
      "use strict";
      init_unicode();
      NumericSolver = class {
        solveAll(constraints, engine, budget) {
          const digitSumConstraint = constraints.find((c) => c.type === "sum" && c.target !== void 0);
          const adjustedDigitTarget = (digitSumConstraint?.target ?? 0) - budget.digitSumFromOtherZones;
          const digitCandidates = this.generateDigitString(adjustedDigitTarget);
          const romanMultiplyConstraint = constraints.find((c) => c.type === "roman_multiply" && c.target !== void 0);
          const needsRoman = constraints.some((c) => c.type === "roman_presence");
          let romanString = "";
          if (romanMultiplyConstraint) {
            romanString = this.intToRoman(Math.max(0, romanMultiplyConstraint.target));
          } else if (needsRoman) {
            if (budget.romanValueFromOtherZones === 0) {
              romanString = "V";
            }
          }
          const totalNewLength = budget.totalLength - (engine.getZone("digits")?.content.length || 0) - (engine.getZone("roman")?.content.length || 0) + digitCandidates.length + romanString.length;
          const newDigitCount = budget.digitCount - digitCount(engine.getZone("digits")?.content || "") + digitCount(digitCandidates);
          const digitPercentConstraint = constraints.find((c) => c.type === "ratio");
          if (digitPercentConstraint && digitPercentConstraint.maxRatio && newDigitCount / totalNewLength > digitPercentConstraint.maxRatio) {
            return this.solveWithLengthConstraint(constraints, budget, engine);
          }
          return {
            digits: digitCandidates,
            roman: romanString,
            elements: ""
            // Placeholder
          };
        }
        solveWithLengthConstraint(constraints, budget, engine) {
          return { digits: "0", roman: "", elements: "" };
        }
        generateDigitString(target) {
          if (target <= 0) return "";
          const nines = Math.floor(target / 9);
          const remainder = target % 9;
          const digits = [];
          if (remainder > 0) digits.push(remainder);
          for (let i = 0; i < nines; i++) digits.push(9);
          return digits.join("");
        }
        intToRoman(num) {
          if (num <= 0) return "";
          const vals = [1e3, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
          const syms = ["M", "CM", "D", "CD", "C", "XC", "L", "XL", "X", "IX", "V", "IV", "I"];
          let result = "";
          for (let i = 0; i < vals.length; i++) {
            while (num >= vals[i]) {
              result += syms[i];
              num -= vals[i];
            }
          }
          return result;
        }
      };
      NumericHandler = class {
        constructor(solver) {
          this.solver = solver;
        }
        solver;
        async solve(rule, engine, budgetTracker) {
          const budget = budgetTracker.compute(engine);
          const solution = this.solver.solveAll([parseNumericConstraint(rule)], engine, budget);
          return {
            zone: "digits",
            content: solution?.digits || "",
            priority: 40
          };
        }
      };
    }
  });

  // src/content/conflict-resolver.ts
  var ConflictResolver;
  var init_conflict_resolver = __esm({
    "src/content/conflict-resolver.ts"() {
      "use strict";
      init_numeric();
      ConflictResolver = class {
        maxAttempts = 8;
        numericSolver;
        handlers;
        constructor(numericSolver, handlers) {
          this.numericSolver = numericSolver;
          this.handlers = handlers;
        }
        async resolve(broken, allRules, engine, budget) {
          let attempts = 0;
          let currentBroken = [...broken];
          while (currentBroken.length > 0 && attempts < this.maxAttempts) {
            attempts++;
            const currentBudget = budget.compute(engine);
            const numericBroken = currentBroken.filter((r) => r.category === "numeric");
            if (numericBroken.length > 0) {
              const allNumeric = [...allRules.values()].filter((r) => r.category === "numeric");
              const solution = this.numericSolver.solveAll(
                allNumeric.map(parseNumericConstraint),
                engine,
                currentBudget
              );
              if (solution) {
                if (solution.digits !== void 0) engine.setZone("digits", solution.digits, 40, []);
                if (solution.roman !== void 0) engine.setZone("roman", solution.roman, 50, []);
                if (solution.elements !== void 0) engine.setZone("elements", solution.elements, 60, []);
              }
            }
            const otherBroken = currentBroken.filter((r) => r.category !== "numeric" && r.category !== "human");
            for (const rule of otherBroken) {
              const zone = engine.getZone(`human_${rule.number}`);
              if (zone?.locked) continue;
              const handler = this.handlers.get(rule.category);
              if (!handler) continue;
              const update = await handler.solve(rule, engine, budget);
              const violations = budget.checkProposal(
                engine,
                update.zone,
                update.content,
                this.getGlobalConstraints(allRules)
              );
              if (violations.length === 0) {
                engine.setZone(update.zone, update.content, update.priority, [rule.number]);
              } else {
                console.warn(
                  `[PWG] Handler for rule #${rule.number} proposed change that would violate: ` + violations.map((v) => v.constraint).join(", ") + " \u2014 skipping, will retry"
                );
              }
            }
            break;
          }
          if (currentBroken.length > 0) {
            console.error(`[PWG] ${currentBroken.length} rules unresolvable after ${this.maxAttempts} attempts`);
          }
        }
        getGlobalConstraints(allRules) {
          return [];
        }
      };
    }
  });

  // src/content/main-loop.ts
  var MainLoop;
  var init_main_loop = __esm({
    "src/content/main-loop.ts"() {
      "use strict";
      init_numeric();
      MainLoop = class {
        constructor(domReader, domWriter, domObserver, engine, budget, classifier, numericSolver, conflictResolver, handlers, humanHandler) {
          this.domReader = domReader;
          this.domWriter = domWriter;
          this.domObserver = domObserver;
          this.engine = engine;
          this.budget = budget;
          this.classifier = classifier;
          this.numericSolver = numericSolver;
          this.conflictResolver = conflictResolver;
          this.handlers = handlers;
          this.humanHandler = humanHandler;
        }
        domReader;
        domWriter;
        domObserver;
        engine;
        budget;
        classifier;
        numericSolver;
        conflictResolver;
        handlers;
        humanHandler;
        running = false;
        paused = false;
        knownRules = /* @__PURE__ */ new Map();
        tickLock = false;
        async start() {
          this.running = true;
          this.log("Initializing...");
          const strategy = await this.domWriter.detectStrategy();
          this.log(`Write strategy: ${strategy}`);
          this.engine.setZone("base", "Helicopter1!", 10, []);
          this.domWriter.typePassword(this.engine.getPassword());
          this.domObserver.onRulesChanged(() => this.scheduleTick());
          setInterval(() => this.scheduleTick(), 5e3);
          await this.domObserver.waitForStability();
          await this.tick();
          this.log("Solver running");
        }
        scheduleTick() {
          if (this.tickLock || this.paused || !this.running) return;
          queueMicrotask(() => this.tick());
        }
        async tick() {
          if (this.tickLock) return;
          this.tickLock = true;
          try {
            await this.domObserver.waitForStability(200, 3e3);
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
                this.log(`\u23F8 Waiting for human input on rule #${rule.number}`);
                const input = await this.requestHumanInput(rule, `Human input required for rule #${rule.number}: ${rule.text}`);
                this.engine.setZone(`human_${rule.number}`, input, 90 + rule.number, [rule.number]);
                this.engine.lockZone(`human_${rule.number}`);
                const newBudget = this.budget.compute(this.engine);
                this.log(`Post-human budget: len=${newBudget.totalLength}, digitSum=${newBudget.digitSumFromOtherZones}, romanPollution=${newBudget.romanValueFromOtherZones}`);
                for (const [category, handler] of Array.from(this.handlers.entries())) {
                  if (category === "human") continue;
                  const rulesInCategory = [...this.knownRules.values()].filter((r) => r.category === category);
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
              this.domWriter.typePassword(this.engine.getPassword());
              this.log(`Attempted to type: ${this.engine.getPassword()}`);
              await this.domObserver.waitForStability();
              this.log(`Actual text in editor AFTER typing: ${this.domWriter.getCurrentEditorText()}`);
            }
            const updatedRules = this.domReader.readRules();
            const broken = updatedRules.filter((r) => !r.satisfied && this.knownRules.has(r.number));
            if (broken.length > 0) {
              this.log(`Broken: ${broken.map((r) => `#${r.number}`).join(", ")}`);
              await this.conflictResolver.resolve(broken, this.knownRules, this.engine, this.budget);
              this.domWriter.typePassword(this.engine.getPassword());
              await this.domObserver.waitForStability();
            }
            if (this.domReader.checkWin()) {
              this.log("\u{1F3C6} GAME WON!");
              this.running = false;
            }
          } catch (err) {
            this.log(`Tick error: ${err}`, "error");
          } finally {
            this.tickLock = false;
          }
        }
        resolveAllNumeric() {
          const numericRules = [...this.knownRules.values()].filter((r) => r.category === "numeric");
          if (numericRules.length === 0) return;
          this.log(`Resolving numeric rules: ${numericRules.map((r) => r.text).join(" | ")}`);
          const currentBudget = this.budget.compute(this.engine);
          this.log(`Current Budget: DigitsSum=${currentBudget.digitSumFromOtherZones}`);
          const constraints = numericRules.map((r) => parseNumericConstraint(r));
          this.log(`Constraints: ${JSON.stringify(constraints)}`);
          const solution = this.numericSolver.solveAll(
            constraints,
            this.engine,
            currentBudget
          );
          if (solution) {
            this.log(`Solution applied: digits=${solution.digits}, roman=${solution.roman}`);
            if (solution.digits !== void 0) this.engine.setZone("digits", solution.digits, 40, []);
            if (solution.roman !== void 0) this.engine.setZone("roman", solution.roman, 50, []);
            if (solution.elements !== void 0) this.engine.setZone("elements", solution.elements, 60, []);
            this.log(`New password: ${this.engine.getPassword()}`);
          } else {
            this.log("Numeric solver failed \u2014 flagging to user", "error");
          }
        }
        async requestHumanInput(rule, prompt) {
          return this.humanHandler.requestInput(rule, prompt);
        }
        log(msg, level = "info") {
          const prefix = `[PWG ${(/* @__PURE__ */ new Date()).toLocaleTimeString()}]`;
          level === "error" ? console.error(`${prefix} ${msg}`) : console.log(`${prefix} ${msg}`);
          if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({ type: "LOG", msg, level }).catch(() => {
              this.running = false;
            });
          } else if (typeof chrome !== "undefined" && (!chrome.runtime || !chrome.runtime.id)) {
            this.running = false;
          }
        }
      };
    }
  });

  // src/content/handlers/human.ts
  var HumanHandler;
  var init_human = __esm({
    "src/content/handlers/human.ts"() {
      "use strict";
      HumanHandler = class {
        /**
         * Send a message to the background script / popup to request human input.
         */
        async requestInput(rule, promptText) {
          return new Promise((resolve) => {
            if (document.getElementById(`pwg-human-input-${rule.number}`)) return;
            const overlay = document.createElement("div");
            overlay.id = `pwg-human-input-${rule.number}`;
            overlay.style.position = "fixed";
            overlay.style.bottom = "20px";
            overlay.style.right = "20px";
            overlay.style.backgroundColor = "#ff4d4d";
            overlay.style.color = "white";
            overlay.style.padding = "20px";
            overlay.style.borderRadius = "8px";
            overlay.style.zIndex = "999999";
            overlay.style.boxShadow = "0 8px 16px rgba(0,0,0,0.5)";
            overlay.style.fontFamily = "sans-serif";
            overlay.style.width = "300px";
            overlay.innerHTML = `
        <h3 style="margin-top:0;font-size:16px;">\u{1F916} PWG Solver Needs You!</h3>
        <p style="font-size:14px;margin-bottom:10px;">${promptText}</p>
        <input type="text" id="pwg-input-field-${rule.number}" style="width:100%;padding:8px;box-sizing:border-box;border-radius:4px;border:none;margin-bottom:10px;font-size:16px;color:black;" placeholder="Type here..." />
        <button id="pwg-submit-btn-${rule.number}" style="width:100%;padding:10px;background:#222;color:white;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">Submit</button>
      `;
            document.body.appendChild(overlay);
            const inputEl = document.getElementById(`pwg-input-field-${rule.number}`);
            const btnEl = document.getElementById(`pwg-submit-btn-${rule.number}`);
            inputEl.focus();
            const submit = () => {
              const val = inputEl.value;
              if (!val) return;
              overlay.remove();
              resolve(val);
            };
            btnEl.addEventListener("click", submit);
            inputEl.addEventListener("keydown", (e) => {
              if (e.key === "Enter") submit();
            });
          });
        }
        async solve(rule, engine, budgetTracker) {
          const prompt = `Human input required for rule #${rule.number}: ${rule.text}`;
          const input = await this.requestInput(rule, prompt);
          return {
            zone: `human_${rule.number}`,
            content: input,
            priority: 90 + rule.number
          };
        }
      };
    }
  });

  // src/content/handlers/text.ts
  var TextHandler;
  var init_text = __esm({
    "src/content/handlers/text.ts"() {
      "use strict";
      TextHandler = class {
        async solve(rule, engine, budgetTracker) {
          const t = rule.text.toLowerCase();
          if (t.includes("sponsor")) {
            return {
              zone: "sponsor",
              content: "pepsi",
              priority: 65
            };
          }
          if (t.includes("moon")) {
            return {
              zone: "moon",
              content: this.getMoonPhase(),
              priority: 60
            };
          }
          if (t.includes("periodic") || t.includes("symbol")) {
            return {
              zone: "periodic",
              content: "He",
              priority: 15
            };
          }
          return {
            zone: "text",
            content: "",
            // placeholder, engine initialization handles the default base nicely
            priority: 20
          };
        }
        getMoonPhase(date = /* @__PURE__ */ new Date()) {
          const lp = 2551443;
          const now = date.getTime() / 1e3;
          const newMoon = 947182440;
          const phase = (now - newMoon) % lp / lp;
          if (phase < 0.03 || phase > 0.97) return "\u{1F311}";
          if (phase < 0.22) return "\u{1F312}";
          if (phase < 0.28) return "\u{1F313}";
          if (phase < 0.47) return "\u{1F314}";
          if (phase < 0.53) return "\u{1F315}";
          if (phase < 0.72) return "\u{1F316}";
          if (phase < 0.78) return "\u{1F317}";
          return "\u{1F318}";
        }
      };
    }
  });

  // src/content/handlers/pattern.ts
  function pickMonth(budget, romanTarget) {
    if (romanTarget === null) {
      return "May";
    }
    const sorted = Object.entries(MONTHS_BY_ROMAN_POLLUTION).sort((a, b) => a[1] - b[1]);
    return sorted[0][0];
  }
  var MONTHS_BY_ROMAN_POLLUTION, PatternHandler;
  var init_pattern = __esm({
    "src/content/handlers/pattern.ts"() {
      "use strict";
      MONTHS_BY_ROMAN_POLLUTION = {
        "January": 1,
        // I=1
        "February": 0,
        "March": 1e3,
        // M
        "April": 1,
        // I=1 
        "May": 0,
        "June": 0,
        "July": 0,
        "August": 0,
        "September": 0,
        "October": 0,
        "November": 0,
        "December": 600
        // D=500, C=100
      };
      PatternHandler = class {
        async solve(rule, engine, budgetTracker) {
          const budget = budgetTracker.compute(engine);
          if (rule.text.includes("month")) {
            const month = pickMonth(budget, 35);
            return {
              zone: "month",
              content: month,
              priority: 30
            };
          }
          return { zone: "pattern", content: "pattern", priority: 31 };
        }
      };
    }
  });

  // src/content/handlers/time.ts
  var TimeHandler;
  var init_time = __esm({
    "src/content/handlers/time.ts"() {
      "use strict";
      TimeHandler = class {
        async solve(rule, engine, budgetTracker) {
          const now = /* @__PURE__ */ new Date();
          const formatted = `${now.getHours()}:${now.getMinutes().toString().padStart(2, "0")}`;
          return {
            zone: "time",
            content: formatted,
            priority: 45
          };
        }
      };
    }
  });

  // src/content/handlers/external.ts
  var ExternalHandler;
  var init_external = __esm({
    "src/content/handlers/external.ts"() {
      "use strict";
      ExternalHandler = class {
        constructor(humanHandler) {
          this.humanHandler = humanHandler;
        }
        humanHandler;
        async solve(rule, engine, budgetTracker) {
          if (rule.text.includes("Wordle") || rule.text.includes("wordle")) {
            return this.solveWordle(rule, engine);
          }
          if (rule.text.includes("YouTube") || rule.text.includes("youtube")) {
            return this.solveYouTube(rule, engine);
          }
          if (rule.text.toLowerCase().includes("country")) {
            return this.solveCountry(rule);
          }
          return this.fallbackToHuman(rule, "External rule requiring manual input:");
        }
        async solveCountry(rule) {
          const country = window.__pwgCountryAnswer;
          if (country) {
            console.log(`[PWG] \u{1F5FA}\uFE0F Auto-solved GeoGuessr: ${country}`);
            return { zone: "country", content: country, priority: 85 };
          }
          console.warn("[PWG] GeoGuessr country not available automatically, asking user.");
          return this.fallbackToHuman(rule, "GeoGuessr: What country is shown on the map?");
        }
        async solveWordle(rule, engine) {
          const answer = await this.tryWithTimeout(async () => {
            const domAnswer = this.findWordleInDOM();
            if (domAnswer) return domAnswer;
            try {
              const d = /* @__PURE__ */ new Date();
              const yyyy = d.getFullYear();
              const mm = String(d.getMonth() + 1).padStart(2, "0");
              const dd = String(d.getDate()).padStart(2, "0");
              const url = `https://www.nytimes.com/svc/wordle/v2/${yyyy}-${mm}-${dd}.json`;
              const response = await new Promise((resolve) => {
                chrome.runtime.sendMessage({ type: "FETCH_WORDLE", url }, (res) => resolve(res));
              });
              if (response && response.success && response.data && response.data.solution) {
                return response.data.solution.toLowerCase();
              }
            } catch (e) {
              console.warn("[PWG] Wordle fetch error:", e);
            }
            return null;
          }, 5e3);
          if (answer) {
            return { zone: "wordle", content: answer, priority: 35 };
          }
          console.warn("[PWG] Could not fetch Wordle answer automatically \u2014 asking user");
          return this.fallbackToHuman(rule, "What is today's Wordle answer? (5 letters)");
        }
        async solveYouTube(rule, engine) {
          const durationMatch = rule.text.match(/(\d+)\s*minutes?\s*(?:and\s*)?(\d+)\s*seconds?/i);
          if (durationMatch) {
            const mins = parseInt(durationMatch[1]);
            const secs = parseInt(durationMatch[2]);
            const formatted = `${mins}:${secs.toString().padStart(2, "0")}`;
          }
          return this.fallbackToHuman(
            rule,
            "This rule requires a YouTube URL. Please find a video matching the required duration and paste the URL:"
          );
        }
        async fallbackToHuman(rule, prompt) {
          const input = await this.humanHandler.requestInput(rule, prompt);
          return {
            zone: `external_${rule.number}`,
            content: input,
            priority: 85
          };
        }
        async tryWithTimeout(fn, timeoutMs) {
          return new Promise((resolve) => {
            const timer = setTimeout(() => resolve(null), timeoutMs);
            fn().then((res) => {
              clearTimeout(timer);
              resolve(res);
            }).catch(() => {
              clearTimeout(timer);
              resolve(null);
            });
          });
        }
        findWordleInDOM() {
          return null;
        }
      };
    }
  });

  // src/content/index.ts
  var require_index = __commonJS({
    "src/content/index.ts"() {
      init_dom_reader();
      init_dom_writer();
      init_dom_observer();
      init_password_engine();
      init_budget();
      init_rule_classifier();
      init_conflict_resolver();
      init_main_loop();
      init_human();
      init_text();
      init_numeric();
      init_pattern();
      init_time();
      init_external();
      window.addEventListener("message", (event) => {
        if (event.source !== window || !event.data || event.data.type !== "PWG_GEO_HACK") {
          return;
        }
        window.__pwgCountryAnswer = event.data.country;
        console.log("[PWG] \u{1F5FA}\uFE0F GeoGuessr intercepted! Setting country:", event.data.country);
      });
      async function init() {
        const domReader = new DOMReader();
        const domWriter = new DOMWriter();
        const domObserver = new DOMObserver();
        const engine = new PasswordEngine();
        const budget = new BudgetTracker();
        const classifier = new RuleClassifier();
        const humanHandler = new HumanHandler();
        const numericSolver = new NumericSolver();
        const handlers = /* @__PURE__ */ new Map();
        handlers.set("text", new TextHandler());
        handlers.set("numeric", new NumericHandler(numericSolver));
        handlers.set("human", humanHandler);
        handlers.set("pattern", new PatternHandler());
        handlers.set("time", new TimeHandler());
        handlers.set("external", new ExternalHandler(humanHandler));
        const conflictResolver = new ConflictResolver(numericSolver, handlers);
        const mainLoop = new MainLoop(
          domReader,
          domWriter,
          domObserver,
          engine,
          budget,
          classifier,
          numericSolver,
          conflictResolver,
          handlers,
          humanHandler
        );
        mainLoop.start();
      }
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
      } else {
        init();
      }
    }
  });
  require_index();
})();
//# sourceMappingURL=content.js.map
