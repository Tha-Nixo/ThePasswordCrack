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
          if (text.includes("<b>") || text.includes("<strong>")) {
            document.execCommand("insertHTML", false, text);
          } else {
            document.execCommand("insertText", false, text);
          }
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
          if (/wordle/i.test(t) || /youtube/i.test(t) || /country/i.test(t) || /chess/i.test(t)) {
            return "external";
          }
          if (/captcha/i.test(t) || /maps/i.test(t) || /geoguessr/i.test(t)) {
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

  // src/content/solver/elements.ts
  function scanElements(text) {
    const clean = text.replace(/[^a-zA-Z]/g, "");
    const found = [];
    let sum = 0;
    let i = 0;
    while (i < clean.length) {
      if (i + 1 < clean.length) {
        const twoChar = clean.substring(i, i + 2);
        if (ELEMENTS_2[twoChar] !== void 0) {
          const an = ELEMENTS_2[twoChar];
          found.push({ symbol: twoChar, atomicNumber: an });
          sum += an;
          i += 2;
          continue;
        }
      }
      const oneChar = clean[i];
      if (ELEMENTS_1[oneChar] !== void 0) {
        const an = ELEMENTS_1[oneChar];
        found.push({ symbol: oneChar, atomicNumber: an });
        sum += an;
      }
      i += 1;
    }
    return { sum, found };
  }
  function generateElementString(targetSum) {
    if (targetSum <= 0) return "";
    const candidates = [
      { symbol: "Og", atomicNumber: 118 },
      { symbol: "Ts", atomicNumber: 117 },
      { symbol: "Lv", atomicNumber: 116 },
      { symbol: "Mc", atomicNumber: 115 },
      { symbol: "Fl", atomicNumber: 114 },
      { symbol: "Nh", atomicNumber: 113 },
      { symbol: "Cn", atomicNumber: 112 },
      { symbol: "Rg", atomicNumber: 111 },
      { symbol: "Ds", atomicNumber: 110 },
      { symbol: "Mt", atomicNumber: 109 },
      { symbol: "Hs", atomicNumber: 108 },
      { symbol: "Bh", atomicNumber: 107 },
      { symbol: "Sg", atomicNumber: 106 },
      { symbol: "Db", atomicNumber: 105 },
      { symbol: "Rf", atomicNumber: 104 },
      { symbol: "Lr", atomicNumber: 103 },
      { symbol: "No", atomicNumber: 102 },
      { symbol: "Md", atomicNumber: 101 },
      { symbol: "Fm", atomicNumber: 100 },
      { symbol: "Es", atomicNumber: 99 },
      { symbol: "Cf", atomicNumber: 98 },
      { symbol: "Bk", atomicNumber: 97 },
      { symbol: "Cm", atomicNumber: 96 },
      { symbol: "Am", atomicNumber: 95 },
      { symbol: "Pu", atomicNumber: 94 },
      { symbol: "Np", atomicNumber: 93 },
      { symbol: "Th", atomicNumber: 90 },
      { symbol: "Ac", atomicNumber: 89 },
      { symbol: "Ra", atomicNumber: 88 },
      { symbol: "Fr", atomicNumber: 87 },
      { symbol: "Rn", atomicNumber: 86 },
      { symbol: "At", atomicNumber: 85 },
      { symbol: "Po", atomicNumber: 84 },
      { symbol: "Bi", atomicNumber: 83 },
      { symbol: "Pb", atomicNumber: 82 },
      { symbol: "Tl", atomicNumber: 81 },
      { symbol: "Hg", atomicNumber: 80 },
      { symbol: "Au", atomicNumber: 79 },
      { symbol: "Pt", atomicNumber: 78 },
      { symbol: "Ir", atomicNumber: 77 },
      { symbol: "Os", atomicNumber: 76 },
      { symbol: "Re", atomicNumber: 75 },
      { symbol: "Ta", atomicNumber: 73 },
      { symbol: "Hf", atomicNumber: 72 },
      { symbol: "Lu", atomicNumber: 71 },
      { symbol: "Yb", atomicNumber: 70 },
      { symbol: "Tm", atomicNumber: 69 },
      { symbol: "Er", atomicNumber: 68 },
      { symbol: "Ho", atomicNumber: 67 },
      { symbol: "Dy", atomicNumber: 66 },
      { symbol: "Tb", atomicNumber: 65 },
      { symbol: "Gd", atomicNumber: 64 },
      { symbol: "Eu", atomicNumber: 63 },
      { symbol: "Sm", atomicNumber: 62 },
      { symbol: "Nd", atomicNumber: 60 },
      { symbol: "Pr", atomicNumber: 59 },
      { symbol: "Ce", atomicNumber: 58 },
      { symbol: "La", atomicNumber: 57 },
      { symbol: "Ba", atomicNumber: 56 },
      { symbol: "Cs", atomicNumber: 55 },
      { symbol: "Xe", atomicNumber: 54 },
      { symbol: "Te", atomicNumber: 52 },
      { symbol: "Sb", atomicNumber: 51 },
      { symbol: "Sn", atomicNumber: 50 },
      { symbol: "In", atomicNumber: 49 },
      { symbol: "Cd", atomicNumber: 48 },
      { symbol: "Ag", atomicNumber: 47 },
      { symbol: "Pd", atomicNumber: 46 },
      { symbol: "Rh", atomicNumber: 45 },
      { symbol: "Ru", atomicNumber: 44 },
      { symbol: "Tc", atomicNumber: 43 },
      { symbol: "Mo", atomicNumber: 42 },
      { symbol: "Nb", atomicNumber: 41 },
      { symbol: "Zr", atomicNumber: 40 },
      { symbol: "Sr", atomicNumber: 38 },
      { symbol: "Rb", atomicNumber: 37 },
      { symbol: "Kr", atomicNumber: 36 },
      { symbol: "Br", atomicNumber: 35 },
      { symbol: "Se", atomicNumber: 34 },
      { symbol: "As", atomicNumber: 33 },
      { symbol: "Ge", atomicNumber: 32 },
      { symbol: "Ga", atomicNumber: 31 },
      { symbol: "Zn", atomicNumber: 30 },
      { symbol: "Cu", atomicNumber: 29 },
      { symbol: "Ni", atomicNumber: 28 },
      { symbol: "Co", atomicNumber: 27 },
      { symbol: "Fe", atomicNumber: 26 },
      { symbol: "Mn", atomicNumber: 25 },
      { symbol: "Cr", atomicNumber: 24 },
      { symbol: "Ti", atomicNumber: 22 },
      { symbol: "Sc", atomicNumber: 21 },
      { symbol: "Ca", atomicNumber: 20 },
      { symbol: "Ar", atomicNumber: 18 },
      { symbol: "Cl", atomicNumber: 17 },
      { symbol: "Si", atomicNumber: 14 },
      { symbol: "Al", atomicNumber: 13 },
      { symbol: "Mg", atomicNumber: 12 },
      { symbol: "Na", atomicNumber: 11 },
      { symbol: "Ne", atomicNumber: 10 },
      { symbol: "Be", atomicNumber: 4 },
      { symbol: "Li", atomicNumber: 3 },
      { symbol: "He", atomicNumber: 2 }
    ];
    const single = [
      { symbol: "U", atomicNumber: 92 },
      { symbol: "W", atomicNumber: 74 },
      { symbol: "I", atomicNumber: 53 },
      { symbol: "Y", atomicNumber: 39 },
      { symbol: "K", atomicNumber: 19 },
      { symbol: "S", atomicNumber: 16 },
      { symbol: "P", atomicNumber: 15 },
      { symbol: "F", atomicNumber: 9 },
      { symbol: "O", atomicNumber: 8 },
      { symbol: "N", atomicNumber: 7 },
      { symbol: "C", atomicNumber: 6 },
      { symbol: "B", atomicNumber: 5 },
      { symbol: "H", atomicNumber: 1 }
    ];
    const allElements = [...candidates, ...single].filter(
      (el) => !/^[IVXLCDM]/.test(el.symbol)
    );
    const result = [];
    let remaining = targetSum;
    for (const el of allElements) {
      while (remaining >= el.atomicNumber) {
        result.push(el.symbol);
        remaining -= el.atomicNumber;
      }
      if (remaining === 0) break;
    }
    if (remaining !== 0) return null;
    return result.join("");
  }
  var ELEMENTS_2, ELEMENTS_1;
  var init_elements = __esm({
    "src/content/solver/elements.ts"() {
      "use strict";
      ELEMENTS_2 = {
        He: 2,
        Li: 3,
        Be: 4,
        Ne: 10,
        Na: 11,
        Mg: 12,
        Al: 13,
        Si: 14,
        Cl: 17,
        Ar: 18,
        Ca: 20,
        Sc: 21,
        Ti: 22,
        Cr: 24,
        Mn: 25,
        Fe: 26,
        Co: 27,
        Ni: 28,
        Cu: 29,
        Zn: 30,
        Ga: 31,
        Ge: 32,
        As: 33,
        Se: 34,
        Br: 35,
        Kr: 36,
        Rb: 37,
        Sr: 38,
        Zr: 40,
        Nb: 41,
        Mo: 42,
        Tc: 43,
        Ru: 44,
        Rh: 45,
        Pd: 46,
        Ag: 47,
        Cd: 48,
        In: 49,
        Sn: 50,
        Sb: 51,
        Te: 52,
        Xe: 54,
        Cs: 55,
        Ba: 56,
        La: 57,
        Ce: 58,
        Pr: 59,
        Nd: 60,
        Pm: 61,
        Sm: 62,
        Eu: 63,
        Gd: 64,
        Tb: 65,
        Dy: 66,
        Ho: 67,
        Er: 68,
        Tm: 69,
        Yb: 70,
        Lu: 71,
        Hf: 72,
        Ta: 73,
        Re: 75,
        Os: 76,
        Ir: 77,
        Pt: 78,
        Au: 79,
        Hg: 80,
        Tl: 81,
        Pb: 82,
        Bi: 83,
        Po: 84,
        At: 85,
        Rn: 86,
        Fr: 87,
        Ra: 88,
        Ac: 89,
        Th: 90,
        Pa: 91,
        Np: 93,
        Pu: 94,
        Am: 95,
        Cm: 96,
        Bk: 97,
        Cf: 98,
        Es: 99,
        Fm: 100,
        Md: 101,
        No: 102,
        Lr: 103,
        Rf: 104,
        Db: 105,
        Sg: 106,
        Bh: 107,
        Hs: 108,
        Mt: 109,
        Ds: 110,
        Rg: 111,
        Cn: 112,
        Nh: 113,
        Fl: 114,
        Mc: 115,
        Lv: 116,
        Ts: 117,
        Og: 118
      };
      ELEMENTS_1 = {
        H: 1,
        B: 5,
        C: 6,
        N: 7,
        O: 8,
        F: 9,
        P: 15,
        S: 16,
        K: 19,
        V: 23,
        Y: 39,
        I: 53,
        W: 74,
        U: 92
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
      return { type: "atomic_sum", target: match ? parseInt(match[1]) : 0 };
    }
    return { type: "ratio", maxRatio: 0.3 };
  }
  var NumericSolver, NumericHandler;
  var init_numeric = __esm({
    "src/content/handlers/numeric.ts"() {
      "use strict";
      init_unicode();
      init_elements();
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
          const atomicConstraint = constraints.find((c) => c.type === "atomic_sum" && c.target !== void 0);
          let elementsString = "";
          if (atomicConstraint) {
            const pwWithoutElements = engine.getPasswordExcludingZone("elements");
            const oldDigits = engine.getZone("digits")?.content || "";
            const oldRoman = engine.getZone("roman")?.content || "";
            const simulatedPw = pwWithoutElements.replace(oldDigits, digitCandidates).replace(oldRoman, romanString);
            const { sum: currentAtomicSum } = scanElements(simulatedPw);
            const atomicGap = atomicConstraint.target - currentAtomicSum;
            if (atomicGap > 0) {
              elementsString = generateElementString(atomicGap) || "";
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
            elements: elementsString
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
          this.engine.setZone("base", "strongpassword1A!", 10, []);
          this.domWriter.typePassword(this.formatPassword(this.engine.getPassword()));
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
              this.resolveAllNumeric();
              this.domWriter.typePassword(this.formatPassword(this.engine.getPassword()));
              this.log(`Attempted to type: ${this.engine.getPassword()}`);
              await this.domObserver.waitForStability();
              this.log(`Actual text in editor AFTER typing: ${this.domWriter.getCurrentEditorText()}`);
            }
            const updatedRules = this.domReader.readRules();
            const broken = updatedRules.filter((r) => !r.satisfied && this.knownRules.has(r.number));
            if (broken.length > 0) {
              this.log(`Broken: ${broken.map((r) => `#${r.number}`).join(", ")}`);
              await this.conflictResolver.resolve(broken, this.knownRules, this.engine, this.budget);
              this.domWriter.typePassword(this.formatPassword(this.engine.getPassword()));
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
            this.log(`Solution applied: digits=${solution.digits}, roman=${solution.roman}, elements=${solution.elements}`);
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
        formatPassword(password) {
          if (this.knownRules.has(19)) {
            return password.replace(/(<[^>]*>)|([aeiouyAEIOUY])/g, (match, tag, vowel) => {
              return tag ? tag : `<strong>${vowel}</strong>`;
            });
          }
          return password;
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
          if (t.includes("leap year")) {
            return {
              zone: "leapyear",
              content: "2000",
              priority: 50
            };
          }
          if (t.includes("paul") && (t.includes("feed") || t.includes("eats") || t.includes("\u{1F41B}"))) {
            return {
              zone: "egg",
              content: "\u{1F414}\u{1F41B}\u{1F41B}\u{1F41B}",
              priority: 70
            };
          }
          if (t.includes("chicken") || t.includes("paul") || t.includes("hatched") || t.includes("\u{1F95A}")) {
            return {
              zone: "egg",
              content: "\u{1F95A}",
              priority: 70
            };
          }
          if (t.includes("strong")) {
            return {
              zone: "strong",
              content: "\u{1F3CB}\uFE0F\u200D\u2642\uFE0F\u{1F3CB}\uFE0F\u200D\u2642\uFE0F\u{1F3CB}\uFE0F\u200D\u2642\uFE0F",
              priority: 75
            };
          }
          if (t.includes("affirmation") || t.includes("loved") || t.includes("worthy") || t.includes("enough")) {
            return {
              zone: "affirmation",
              content: "i am loved",
              priority: 76
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
      return "may";
    }
    const sorted = Object.entries(MONTHS_BY_ROMAN_POLLUTION).sort((a, b) => a[1] - b[1]);
    return sorted[0][0].toLowerCase();
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

  // src/content/handlers/youtube-ids.ts
  var youtubeIds;
  var init_youtube_ids = __esm({
    "src/content/handlers/youtube-ids.ts"() {
      "use strict";
      youtubeIds = ["Uv-FQA68D7I", "6H-EJaylVYc", "CvAOKjUcXPY", "eG1dLY8KKqY", "1jxQBTZEUeA", "LG3Sroo5aVU", "7B0mpZtsZ-4", "GAHcSMc516Y", "A4tVApMTDBU", "1wQGSnAa2TA", "3xA6KrpHhdQ", "sxfm9LN20yo", "YlLc0vLj03g", "m7JuBjwKM-4", "HpnbQjC5suw", "Yq03qxyHU2Y", "Lz6oJAjlgXk", "FsXzMWEjn24", "FH5wBnK-nkY", "hv7eR2uxls8", "cjL2oWcyIOs", "C-cf4QEn6DI", "dh5PL0knZFw", "UwGO5eWnAfY", "-kA3AiHxh70", "fgrgkM8TH84", "s54d7hbKE7I", "GUqD2gQD_7g", "X8sYigss7sk", "I3v8GC6JYOY", "GG5y7LJUIqk", "4OKjod_72Fw", "0D9zlhU_n2Q", "28FgbMR-VFo", "EwBLcNwiBl4", "6EvA5V8Ll04", "w9v0-3e-Hns", "Z61buHxPObk", "vh7a2TZ51jQ", "fTl8jyPMjrE", "NKlXSMzaO48", "2erDKmDfn6s", "WdNAXfZRTvs", "ZeBErKlH6XY", "sKBMUi5a5ms", "RSSms450U1Y", "i3Q8GNz43cU", "pypQxyb3pDA", "HtPsNiENejk", "eZof00kLKF0", "uaz34JOBTsw", "Sp2M3HuqFpE", "0soglTNEeQc", "xI0rn7oW_hk", "b4PKjsRDGyM", "5uNsG8IhMVU", "eHU5lRsqUKg", "tkuvdggm104", "MjVG3KwMzsI", "E_NPLqEuYzI", "euzwQ8VbsL8", "B21BZ-askdg", "Y34H5R0QiPk", "x56ekg9LJFQ", "z77euCXjXvs", "UwRiqekk_58", "13zNLnqRSaM", "GTUpq3xrEPw", "iUHv_-3NDMc", "wF-0SUgLH9Y", "u-z3kI_p_oU", "Fgi91wE9Ys0", "T2mumpQvFHA", "DvJpVN7hhOI", "rwndw7zwaS0", "frOBG8nbALA", "8KaxBCNcjig", "MUTIcxdXetY", "tbQZVcespqg", "GDI0Pn9A7aI", "aqqoT-45sIU", "QUbVAPuZ0u0", "qIsrqjA-VHE", "d9DSNjNbpRE", "mkYcewk91Mc", "Ma1wQ6oWWUo", "0KLM9oQuqig", "o_NWAclKXfg", "vAquCYDQzOc", "wGuYtFrJBUM", "4skYStlDAUw", "CV9ZjqwbTOI", "nc-ld57W_9Y", "SwbduOnL5UY", "v6selziaZNY", "0Fn8d3cE9u8", "JFQfStZcQFY", "5LLs6BVcXh4", "AKA_7ien6bo", "LJ8kibGvymE", "XPtBk-uidJs", "Xx_ST7a-ZH0", "Zmx_bzRdF8c", "ga4KUt6pTh0", "ubTcUUS9UK8", "4WnMAVbikVo", "-1T9LvK0HNk", "VTezWWc4BJs", "CYWOSs5J_BQ", "Hj6UlQCewNw", "eIgQ2-o7D3k", "XBlAto0-H_U", "X6I-Wmf_E8w", "JE7ybN5uR44", "Iu_4_Dz2TUM", "MBLvI2o9VvM", "DTx07VL-Rwc", "T05rmw5RIy8", "tp3jVzswFTg", "Ow7xuxxzkS8", "pjfvPT1KicE", "w23VkecICrc", "O5BZ2p4LsbA", "r5sa_md7vsA", "RAwCTlAPyEA", "PLkf-RK_z7Q", "Q3QTFLVoj8g", "xEp4v5magoQ", "zasFpQ9ZAOs", "O2jZBA7Ep8E", "6LW1wEHolWU", "I0oud0Nq7ic", "wwsEdhwC7Es", "NuZExBmveoU", "5m4b9_75isk", "730UIBW1QOo", "C-TneC-uf2k", "yOggGCcHqA8", "AG4D4Gu9cn4", "m808y-hnQqg", "ilQBxerosyE", "Ie4mohdXg6g", "YoIG7ubUS18", "haKECqzxXk8", "JCgjXKM2pOY", "eMIbAXt9I6w", "T-cknD43i2w", "5hzhxACXkUM", "AI6VYuYPdzM", "FacepCkSfCA", "A2eowuNV2W4", "7KatKhUebGc", "BDk8oeAAXX8", "w0hT11a3p3c", "yf8mJvGcJiE", "jmE3CxIq908", "Y07D5i4i5fQ", "-u9E4n1RvTc", "ykd00tx6Xxs", "mgyxnydgwAw", "Xb31UW_BIYI", "tuLyAB-BBRY", "LUuEderqIL4", "YT4XBqTsTdk", "HRmORNoHI3E", "RdMmp8Qacrc", "Hs0N28a5g0o", "fK71eRiM9QQ", "WaYM3LUcnMs", "azFyjBVGEFY", "h4gUdElS0iU", "t65Mjn-Wqwg", "3tihW9geLyc", "lZ_OgtPo7Fw", "z7BnpliMmQ4", "-nxvjYwpKg4", "PehkwuQsdac", "6MGLeF9OIYk", "nrqV-YzS1nM", "ApZscpCZVY0", "FJlVCHmhM_s", "aJ6Q3IcRsJ0", "hN3VFvvUEfQ", "1jXIL-8URzQ", "sFzkedji21Q", "jB8wls_afcI", "xriZ3FNklX8", "NNJYyKbFZWU", "L5w5cN2WhCE", "f3SQ92WD3lw", "PsJ--2yqcbg", "w1IU7ysVXZo", "4PHO3MUfimI", "pYIGAeHlrV0", "QmsrpTeTMAs", "5qnvJ8Ip_ig", "KjB9XXqFTII", "9XWOi-rUu3M", "XjGmfpsSCZo", "jQmH8JatK64", "Iky3fog2RM4", "-vytA498xMU", "lSq7P3N_z7A", "yy0WOtZIe-E", "qNZz6CKCCNs", "NHbjzFdVxOk", "OWcT0b7c4VQ", "8g9F0c1u5ZA", "hUhHMEppWTs", "aZTn2j3ulak", "I1WsElh3BJA", "IfunB0RBzto", "zbtqcxEoPyo", "M0bpZORMTFM", "8FbfWGoM-yA", "rEfBrUAkMCA", "nDs3DfcTCLc", "jLJmMIfk2O8", "Zt3M0htuPIM", "t0xwvzlzF6o", "WJzIUbb6tJw", "kkyn9GFJ6-A", "xrLQdXpBl9o", "0-i47wOi3zg", "GG26kH9XN7c", "OCsSkSyAjmg", "5K8OwAeYJaY", "qhOsHZ2w9YU", "ncFwneHzO-Q", "6iaKoUD9sbI", "fmloK3OMpRA", "D0TuuQNCB9w", "rqtFbY3PRrI", "fnGo0zRcnLk", "60XySFP4Jyw", "XyzB1ZQJ-ys", "rVku_4idi7A", "RIjDD1ZK2uY", "XlsIKCRs4MU", "00aJ7l8vCw4", "TrA71eacmWo", "Ba8nqODzrq0", "FH2hYun0Ht4", "amRR5roGOQ4", "hSP7bAsnDDs", "sQ8LS2IyeMQ", "ia2FNjnhJ3k", "fULN15Y9eLU", "8ckjggXrdD8", "vWXqzi7sXT4", "h-osHtvvLIo", "nkk2RY4BGh4", "DeCDvPv_Zks", "knCCT6gcPLc", "g80Ld2NZkEk", "1-33DgzSEFM", "fDbURvKQZQM", "3R7zf6lACHU", "gro4AW0tl3E", "1WkHNmufZI4", "64BymbStTYY", "Z__QpNZqd4Y", "e6B_c6AiOp4", "Y6As7FUKgW8", "W1s3AxpcGU0", "bYX5t5MjQqw", "t4yHYloD5dU", "xfBHVfh076s", "zK_ct6uuwOU", "3IYHbgeyS38", "vZnvvKrq2Pc", "-6Ad2j7vgK8", "maQ345ylW2A", "k5go3VGmyrQ", "gVi7YDKCy24", "5V4AofKWNnw", "X-OWF5PMCrU", "BG7XDixo7xo", "l1NZ9vVLT7Q", "yUubei3ktZw", "1IS3spcjFOk", "Ip5mcfB6FDM", "l_j2by06lFA", "8J66C2sc0Mk", "oD6q3YYflP0", "deTMcKT43ws", "_SSx5pizNG8", "yuqgxIHdIW8", "VqLBjC4jojg", "VUtzOjbgG3A", "W24Ed8ANvHQ", "HGyyP0AvLAs", "iz_AnXXCA4U", "CIo16dHReos", "ZstP7z4mKSQ", "dpPP9VDYZCc", "HluHph256Jk", "i3Vh4q27hBs", "ZMX9aBau404", "eODp2RRIq9c", "4yZhCTpWRhU", "YbFSKThQB5E", "kxqu6Ml9hws", "827h0pWJLag", "fuLQCwA_GG0", "RLvpcLu5sVQ", "6yb1GoM6WpI", "1iLByX5MEEA", "EoM5EMzKhB4", "eH-PmQWhK2w", "5L5JGuCc8vU", "1rg7YNpS4SU", "AF1XCly3eA4", "K4ZUfDNZvAA", "SE_W3F7jt-0", "K4vWeFrhZLs", "C5Kgfps48LE", "37f7xWx_yNg", "tvrsRiMjj8I", "r8vfUCk7qns", "XbcS0iytxE0", "SRlLDL1PdGA", "xPa7_78DUEY", "l0Yesvx4VRA", "J8st9xevryk", "xPtQSpS31s0", "KjDBIIesqUc", "QGM7zHGc4Ns", "Tefztr5h-Pg", "jSTfsGHLu58", "U6Tv5ciTI7k", "2yk0PPiXzFo", "E0qRnPE6RZQ", "2EKa2-MaJDc", "vg0lRZA1pKg", "V7R6aS-YYWY", "1JD2eiWwzv4", "mNunEUve0WE", "8X9kULJxPd8", "dpjUqTl0jGM", "XAQI1JGm9mM", "VuUNg0WrTWo", "cH5fFkWtor0", "UVMjKPA3igg", "DByK6QRmJdg", "8voesPrPZmQ", "5KWpLikD2cQ", "FCHu9EqguNM", "TMlWHfT_GQY", "x8W1dVlVR3o", "HHw2KQUZkJ4", "1JvowQwC6No", "AcjuN-Umz_4", "tiUwYky5F5U", "A-USo6MEH3I", "V_s0rjmp-8g", "t2HBNF81cbY", "HuK_yBH1FQQ", "nEVuRpcJB-A", "PSzEc5sbDIc", "iKIov_P1bS8", "aIy2-yPznGo", "Pxwi8C6P-LU", "uZY3Uj0mLfQ", "FbOrddUg9sg", "p5YaYg7sChQ", "fNuCojajZ1k", "r0q2pXhYTS8", "krF_GPy5STQ", "-6ObXcM4rzk", "wboxWUTXdn4", "Jx2bx8zzVJM", "FE-jOAD5ABg", "jxOJjGRmPE8", "PihhFQZe7eU", "P7-I6bvWqR0", "Rudqrl8aph8", "9UQpjg0bbOQ", "Od5Wg7GQlh0", "BDMVU_6iWaY", "ADmwHaTVYIY", "ybx3rd55MOg", "mzytZ-syJ7E", "5LpVDNJlqJ4", "DQ1hg1Ukj28", "79RdbRSJEkY", "BQa0Ily8yAM", "glTtyI-u_T8", "VbdxI47BGnk", "388mVeQj1gA", "9pLH1Uy9FuE", "Q98r2GxeAuE", "ZleFBc2ze-4", "RdGuCluxKTs", "dLFNrP1vyoc", "5f7C0OVe8rg", "HcXdjKaq4Xc", "UmZQz1FkRZY", "bZfne6tOfWc", "WOTQ-iYSnM4", "fFka-CdQooo", "2HkHlu3ATIk", "WWG573LpDic", "zbN5p3mQkys", "dyi6IJ4z99Q", "sa36uvhZ3hE", "ZTOn0wPYngs", "Ed2NGjJFKr8", "BEVA6r1kg7U", "JRhShNPpNTo", "RPeIwNj2rcc", "jKQ6UB3qf-I", "KlJ3WUQuZ9s", "JBNKrjySvh4", "bM06yrzREKY", "Tqpgk0z0cpk", "RrlIQUpl0us", "2wo05afHzTQ", "g-oCM4htiIA", "FLeHpJG-I8g", "B7soassHTG8", "mEmrZLxcVzM", "D1GeoZnFa1o", "4OJKT_Lg7A4", "dVeq6phao0E", "6-anGUiTZBY", "3tJ2IehaO38", "y8UdOs0FeYU", "vQSKgPZbz1Q", "BbOjPXDt8k4", "fNTw1WNt9o8", "k_D6ddWchrA", "6MVUp4ng-XE", "fJljPHf__Mk", "EwQYtXBbHh4", "20hMAHlBzUc", "py-1UWt5_wY", "RNRAlQ6o1g4", "vYAXMWD5pAI", "sXbkTCyWS7A", "FIGBgSR--ss", "lm9KKaMuvmo", "tap5QgiFYhU", "4PUigFFc8I4", "a4tWPn_41G0", "lO1-lDzvmZs", "WHuGurA5bG0", "5zNlnN-PPDY", "0RoRCp0YbxM", "WDQc9CZIwOQ", "wpaO_5XiFVg", "GW-C4fjvwZg", "-FaRbQWm2OI", "aXoguAFcJsw", "FjxT7Kpew5U", "9d97Giv2sD4", "BRm6dcDnJVE", "iWYyBZg6dr8", "-cJ_Hgqigaw", "_S72ZJDPb9k", "1gZoWf9gJLk", "lvVeZxpKfa0", "EsYUfDOzCqY", "kf5gc30xOBY", "XdFkPc-qEy4", "e30EwM56rMk", "e1ZznmM0Coc", "LHdqDUd0NX8", "7tQjLrXiyxU", "YmasTAzoPiU", "os97Om8yq2M", "AFAHNl6VEdQ", "y8NID_ONNRw", "YXCiBCv_DBI", "LbInvtY2qYQ", "ObaMTNGcJn8", "iVD7lMvfHvQ", "yrTrDK3LgyY", "lecwsWa2D8Q", "OhoHesyYWkw", "I_56XKErl8U", "9Nux-a4TfyQ", "R4iAlZF4MYM", "Q14y3x5MJ0A", "Fvp0M8yKz9U", "ItoXglOSIo0", "dvHqafTxK8Q", "ukf39j3dBY4", "CxT7ORQLW1g", "6pSY0zbahyc", "yNdnE8Z_IHU", "oFaYSR9wdHM", "BRw1VsWdU4M", "4W1Zkc55sik", "JDVPpnwFPGU", "IX3PWdrcOhE", "jRCpusnQSnU", "pNKzkg4wxKA", "T7gycxQJpvs", "VfVjs9Zd5ew", "RWWmvwWnQx4", "7lONE1irvT8", "kifwepeQTLQ", "msepBE1HlMM", "ch3FFj2OQd8", "OLPfJ0dQIgg", "RSzVIsf3qNM", "-FhOeQBIxGw", "JsAVCUHhmWw", "78VOn3oNDks", "vIN7AbPNmSs", "0liWDy6FY1k", "1N4SIxxXgAU", "FzoMI1Nj-VA", "8q_LnTfVN_k", "_6Lkz6-nwY0", "6_sBrSYRoz8", "MJiGqrWan90", "-IhaHM8Pq9k", "HX8Q18d8e7w", "2zO-f2_GudQ", "UEtlEwbVaCw", "bUTbOiE1M_E", "TvCDrPbUFUE", "8MHhGsTj7Qw", "oqOvuide6dg", "gwK9qnR2lGs", "5rkKlbD03m4", "1tOegTi3gq8", "0shyrMt_400", "_D7KxnRJL4w", "IgH_WzZxsdA", "ukElF_61D-I", "tac6QcmgbnQ", "WT7jj2u3ek8", "XJu-5p8Jt1w", "aJLuRE3KRUY", "1_ZFv2pPQDM", "JIBpYXg3byI", "0ZE3n854LBc", "yeSqiiAgoYE", "1E6An0q6ENs", "YqYqUp2Kkqk", "rRor9ggswm4", "Cb20uA3_Btw", "Jc-XVaaEYeI", "U-bhtTy8gJ8", "cYLywuKTIaM", "tlbu1sF_w5o", "BuFryrmEhKc", "prZBplquJTw", "qXE_VBczO9k", "Xe23tGzCeac", "bgsEsVyBt00", "oz8oFtfcxLk", "hWZMjJ0RrAc", "GZ9ROG7EeMw", "CsURxplEUZM", "rBvqxpM2HRs", "o8aXg2lD0F8", "qUe1qOibC2M", "dF7rTrxFk5I", "n0USsbAG7ww", "ryuN1eF-2kk", "9GSbZpmfFxE", "4tYlYpqsdGE", "XRfa8UkkKG4", "JE0tws5xWeU", "sIYz2_aVT0c", "Q3ynlcBliuk", "2ClJ5bzL2_k", "SJGXz6w-6-U", "h-Nf9OYsRLU", "bIYqoTBlF1g", "XFNe05T_XYY", "N3I5hVAlzW8", "8ZKdeZFlWUs", "44D0vfpRVAQ", "HovDt5YcRE4", "nFrKagLW--o", "vwu3yDzs2fs", "F6cc32-SQU4", "YLWaXk4t9tA", "ZlZg9LgKyig", "x6dPv-jxIKU", "bEYdpj1EDOc", "J53mywkE6hQ", "hQkJyAo7CCk", "cH5XYt03Qlg", "fdOkhtluxVg", "YV_UBxBmNew", "TlQUuVSzqa0", "u7epSMe6BDU", "lsUqpQ2byHI", "-aukAob9YKo", "emDb_K2mNUM", "TUFlcGBO9Bc", "YxO8uQiNUeE", "alG0aLAuiVY", "ORO8wnBP6yk", "ufnmOfYM-u4", "YPkUxbqtCIY", "512euC66Xgo", "oTlRfhmb9a4", "Qxj7qM37l_Q", "XkYThHUXM4k", "7gbuPijjrK4", "a2QizpZswV4", "KUyKhKLH9Bc", "PWWDJtbJ_Js", "Y_rclluCL0I", "nHtTO-DtVYA", "lXGh_p4B-zk", "eOFlCGtu_Po", "56AQUnz7n2Y", "tuUrb5k9Fdo", "fVSjITM1wCg", "ueN-jMWMLn0", "BY_BI_5ThYE", "QieIDY4JREg", "c2Hb3nDYf-g", "s0EHWVcUrhI", "WQOCU_6SVL0", "NnA4ojJukks", "2LJd0AmKgl0", "sDWLPwZYaVI", "45sG2IynH2Y", "cZ0XJI7U4-w", "z7IpupGYQFo", "c0rHpiYf3CM", "h6iPK7Y4OXQ", "1WayQ5c7-RY", "_Np5nq5F4yk", "msr6d2JcFZ8", "_sz0AP3DFaA", "iRspEIaQF7c", "DNo2bW6TW0M", "F0AMUeRv-GY", "Nhe_Izp1syI", "pj-PwBkfd6E", "bCLgXdf7pvI", "dUI-paDKY0w", "VYDsv7lrndg", "c9pcnuan5l0", "r17MYPEBiYU", "DwrEBUED1Rk", "80N74QsqJto", "uyjWixU6BR0", "t7OxrgJd_hI", "rAfss5uGUvc", "UZUBIL0SrNc", "YIc5QSBKnvk", "CReKouvkM0s", "o0eFdLeCIrE", "IhgjaFKSfeg", "uFAS5hbqPRc", "BqGpKUJUE-4", "Vmby7FpyImY", "F7YVcugOtS4", "lZLndFxlZAo", "6OewhyMb87I", "e7fqIEouUsE", "i_rfemJXryY", "Ygs698glys4", "Wl2V7Cd_Fbw", "v2DVEnM6hss", "-aeGyRo994o", "ueyq2beBVyA", "m_vD3qUPN54", "XWEIMl8Mj0Q", "0H8Iw6D98V8", "_pyad_9p_R0", "TdWSgv0kyTc", "DcFDvD91lys", "UGRVd64BxTo", "bg2yjrt0ON0", "AaeyHIMmBIY", "kA_iapxprp8", "AhP5myhWQ6I", "FFRCFzXixJQ", "2a9zjOCUsB0", "rW7wiuCJzSg", "s-wgKgTu-vU", "EerEM1CO-QA", "FP7hC-YpXXw", "n7duNLpT3nk", "P9DnVodLIjY", "R4Us6fTpbLE", "L3WzILexNDs", "LZjZIp97CoY", "2tGcDgJvTH8", "cylExyhUb3Y", "Z8DNvzgPE80", "rtFXJnqtcVk", "cK6C99xXuM0", "BlyLhcz_DIM", "MFkKfqOVUus", "X_CYDCCXgCE", "L6CYTQGxsfc", "-4Rjur2iDbw", "uv-onOvOSUc", "lwr4WwTD3To", "05lwnafCi00", "lABRoMiJAMY", "Uza_NHUNZIc", "P_f2OHnG_Jk", "sO40O2AtC2o", "_fUgscfw7h0", "qbCW-Zmcy3s", "3nNzesl7xNk", "p2gaPfxHETk", "T5ARmtA08oA", "bG4r1G2C_tc", "PR1jOS_Wrmw", "SY0Gdi5wnQ4", "3hjAm_ghD4I", "nyQZXe47j04", "DlXNtz9YR-c", "z3BwO7ik9kw", "5vEjrzLpMAI", "xmiRkn2y5To", "HoaOOydkB20", "6tbrcvPyqts", "CDHeWMi9Jk4", "U_TgVo_H7kw", "H4BIMjhVHm4", "cRzkg0ddkUU", "9aMXbo3_BaI", "y2krQARj628", "fIudE0ndQ30", "B-kyo0DCCVg", "F5t2yBDleaI", "LmP3NE5vECA", "rqCDf-jG7P0", "ehQ8sQ5t8D8", "Mq5BgjfxMa0", "D1BcRmhvN-M", "mZZYGjLTP4A", "Yz36DMV1myc", "FOU_z7uqCC8", "hpvnV85CaEk", "XrFNpMFdXz4", "zcuSDaDHSfs", "-oM9aXbpmMM", "vD-1toFajSY", "cH2xK094wYY", "BRnEHfF-X8M", "w7CDzOB7JBI", "_QOF95FkYds", "wl9HVYrsMNY", "fuALCaMgImA", "ekg5-myzwCc", "1kY2vCUjnXw", "liX72IPSX_U", "7kIwanXEG54", "MeHsoWPd2zg", "fEhXlWYcwbI", "H-aQ14Ba6q8", "E_u2-xv0BFU", "21NYTho7OaU", "gzgGBA1HchY", "f6LymuJGg8U", "vRxgeh2O7IE", "an3f1L92GhQ", "_kYTcsYT594", "lKUSZVuNTJw", "fKVEJ5diCPk", "sOrgDKe99Uo", "9qrrjUMxLWA", "_oj9W0c_6og", "WXmxn19FD54", "D2RKDRFGHF8", "kcrDb1wQxyA", "htp8oUGJ80o", "-cXdQgnfLiw", "VZGYQuvvJkA", "9M5HOkTf7DI", "zfhTkujR0Dc", "DEgq6GdlQoA", "r1E9ol_63CU", "RWI9X32ca3g", "Yfu0kT4YhGI", "HxFZlQj_okk", "gfD2lX0NBlA", "6jsxlU7uhck", "YqbKqQKx1VU", "aRfrZcdv9IQ", "NCqg5jbsGw0", "Uxc-nt7OwAw", "-gmUjWddRzk", "drJiTkTvLFk", "k6LDdLKjJ6w", "mb5mHK3Bc44", "_VEla_UOdT8", "1CbNZ6Z5_Io", "Vw541YfEw1g", "6UKtsvtaYa8", "ChSkH33gixE", "Asvz76w3KI8", "Ol3qGKKL_y0", "oQjZUenOoS0", "MlK-lIoKJcQ", "n-v-sgd0iVg", "_0uW-yd603M", "ypOSiMQNIpM", "UbILwGDB2RE", "q12HB3xwykw", "7RNtQ99xryU", "JeRUhvy2B7Y", "_JpRCiMopzI", "tlCFVJFActI", "sr8KDo1CsQQ", "_UEulg5n0VQ", "OzYjxXf9moo", "lDms7hlUUv0", "R64BZdBVBY8", "sUHlpJQlfnk", "MItLXRZpW80", "DIZLR1Imr9o", "BPmVQ5ybqTI", "CLhJezAsJno", "pZwCp8RPoFk", "ZOMBexEkU60", "2aOFsdAGyhU", "w01Zsvmj34U", "npG_KhNBuw4", "_A18vZD6nTM", "H0a3qJAYmpE", "LufZR0cPlDY", "BQzoSJsPmws", "SfKH5cRAN3E", "zF3iHMUYWaE", "E2-LwiynpcM", "ZioSt3_Rm0A", "iL4D-I2tPEo", "5BGuBs9yVvk", "1SvGWugbpgQ", "j-YbogCer1o", "K1VHRao_Tb0", "M9pGtb9KL6Y", "aCr1-JdYbQU", "k28RQkwXbDI", "UfCQsseRas4", "NTSO28v0Z10", "CdIyJO8QWY4", "MSmf5GUbhxk", "C9vTqNlZTM8", "-pU5IZU0Juc", "qNB3cbaUlfk", "0kGtoErTt4I", "EnR-OLvnmxE", "Q0_9QBwB_4g", "itOBJiX5vPU", "3nWD-bvl92w", "SObDCGH7ssw", "AeWhw8DZ9QA", "v_cU6kf2AJc", "reGHvKd53Yc", "2ahxE1UROu4", "gzLGI4qnOYg", "j1-qZUvrxNs", "VYTmQ7kZLYw", "350_yjm70U0", "YaLIhEvDlPc", "hJE460PNIKw", "1TGxr7iYvdM", "gpfr8jMcqeI", "JezS9pbsYcE", "27O2cNPBec4", "zZXQ4jpfIlE", "SMHedeqWYPg", "xhViVlDuvA0", "JBrn0dYf8HU", "k6ZZwAFsyAc", "vFjPdRqhEB0", "dKbxT9yt8H0", "ATTWH2tW3yQ", "21-RLPJUYF8", "SUjaSGcGd70", "MELjQPlB-Co", "fMojHY8v_F0", "-CWdeCCy1sU", "r7bfMKFm-SM", "NiedMrRfyhg", "PSbOy2nNfkw", "WNXZqUvjka8", "HdDVrIfe0-w", "gw68HiKXOAg", "sPNvcUPO0zE", "Zem0Ltd0SzI", "MHxK9N5W264", "CV1HziZHBfk", "sNdOkIT1dvs", "uOJxSe0Yiec", "eMGUnbcMVwU", "xotNa8Dm5q0", "B_BByFmKACc", "D8VmHQtuJfA", "Xn-Syw5X5h0", "gtv2-Jsov7E", "jPQOOcfB5zw", "IXaJxUBSbsI", "ooiBpX4-JPc", "C5HjAoytYWw", "pTcdzzgETWQ", "_J7TnLI8hVo", "WCWdo9WJl-w", "1Qhqo_mhZ9Y", "EiTLgeJzNr4", "B1YfVKumILc", "5Xkx4Db0G14", "Pp6bwmx4KmU", "nWGvVwXgk74", "50lpLadxEQk", "XnsItyvjU5o", "LXv5Gl7jImE", "3U7RwalPqZA", "kW6OuAX0No4", "lYpMDXY--6E", "TJO09hP42E8", "2gqY5D8OHRE", "2vv2rDwIJfo", "yFk4XdrnB5g", "mGTkHx4MQ_E", "_jTClXoPfYQ", "M3lpbcRpORY", "NGHN8hCtKVE", "GEuv-6ThuBE", "YpoOq6GgSeU", "3Zb0h-OktVo", "X7otKd-OIMU", "cf63k9btS0w", "XuHjM1y8Hxg", "yRAXdyX-pXs", "lOMuBgQHfoA", "fEnItim_y3Q", "eNujvwolpB4", "NsO1dk_a3rk", "b9FvMIiDPK4", "2Ml_NKpa4O0", "VJY75O1OMhY", "e69bVMNJsv8", "kSXqOhQN7OE", "FVWaX58eU20", "WGXyN4khKec", "EUE8rEW6lhA", "j2BakSowEPM", "YPVeuBgaxmg", "j20RPg7k8h4", "LxHNazrl2yo", "UGiL63pf39Q", "7wm6uhTyliU", "efnFQaOG4Yc", "9VF5WxDXkVk", "9FpcMTGKOfg", "E6hhx91i1yA", "A-B0mKBrKoM", "DAJgHO1ZSsk", "8Ms-6MdK8SM", "A3dKvskh8rI", "pvCvTox8dNE", "fvqV_O4-yy8", "u6uOAN68aXo", "NP2jW0rDZDk", "vyPzamDWzK8", "dy94rrDLux8", "uCuOKfk_fQo", "7hPPP0CDUSs", "2gVjKE9tAso", "0Oju34FIcPc", "6v9GlVr_Cjo", "pEM2UTjKm7g", "WK8EoYp-5QI", "os-SaGezrPc", "m-1zRA-nvDI", "QCJ2N1y99yw", "90ZWC4QJex4", "Ki4QiEub6tQ", "k67SUzqaBz4", "3-RUIWar_yw", "JlKD402ZYcs", "N61dHhQOhQA", "I_i6n90W2_A", "QZnhw-dbby0", "gdvcrZ58CQs", "G1PHFCGCpjw", "jbgw7R2uN_E", "jVa2Isl2f5E", "G4scJ0GbuU0", "bMmSQsodzX4", "6z8QUkxCovA", "t9ON_MPRMOw", "QMn7egVn_Fo", "tp_6D2eB9sU", "Gode_wQNyUM", "qAQK1TcXsyc", "XGDS8GK5ypA", "ng5aeDRbD3U", "WJ3oWWbNrMA", "e7xoNf84l-E", "nk9WHbXmyIg", "00cDBooypx0", "CRKXD3-r7p8", "2qmrygoSweE", "6NYJkZ2B2aQ", "8CrROV4Bu_Q", "tuVRAkzvVOs", "WlJN43wUk-U", "OBO558CwEjo", "yQUxKeTj8Bg", "vElYBERIObc", "P0egdkLyFkY", "4nBgx2lCKJc", "w1hjSX-3heM", "_wOKKtiKeYI", "zouOl_xNIF4", "L-xD8jNZF5A", "7RX46Fq56Mo", "7XP8IUEeRYY", "bx1efZoYK4I", "TBVpbbObU8E", "v3PLvGqkPmg", "7RotRhMj2X0", "p868lTpA3Ck", "EEhLW4yM5_8", "fpPHNdLVeOA", "nVurfqcPWI4", "g1Wa0sSOTig", "nqK99EJOygU", "tp9tgcqMuj0", "ANllYeh-pfY", "l0zLLIDi3Nk", "jt50yzNkQjQ", "9Hqk6_x45h8", "wduEWWZaIuc", "p0d8m1asxzM", "3294WWt6mXM", "M9E9DRmTfgs", "9a95SL7D7DI", "49ng0YY_nBM", "9cdrNcP0MDk", "2MStI-64wgg", "9nbLUFAArMQ", "Oz_x_wkbl88", "AceM4nzpxlo", "MyagYh9gAj8", "HG8F95uMTTA", "O41MBlytJ8I", "iS5g2Ebion0", "HT7TBkhHLpE", "VGd8VbYnAx0", "MGRE0HIBPec", "9NT7T9wvYYI", "DOIv6oN_670", "h--y0sHBieo", "myOGL1IJ4Oc", "8wnlVGb5x1A", "i3NVgPVOpik", "OmrpCRbPUzo", "oozHn7W4ZTg", "xHly0siymDM", "KQqkT1apGJE", "zyF_zWWhcas", "eKxVAxcoV7k", "TCsJFZeXr6s", "yfXY5C3ruHY", "iz2YyIo2ksI", "43sq7uVLvXA", "C0XhXbfQLlw", "KTXuKN4dufw", "BSBfseDOVm4", "8c2GkHeoHPw", "xqQRDsVgYow", "w6Z14Ihadyk", "pX8I0dZs3SU", "zjOBy43lY9c", "DKXAxz9YoKA", "2LXdQ2LvCj0", "C26ZEco1AVs", "JtFSx5GNhdU", "t8gZJXdTDqA", "-Hz56z3X1HM", "1k3DW88cKc4", "BmyOqUa5bdE", "TQM9lENpNjw", "QddVqQWWGIM", "iHJrs-mcxIM", "2ZH-N-QT5z0", "Tsjvzc61quY", "7OXAvtEK33A", "PpQF_uEE31Q", "Y6Zxteqs8G8", "9sb6wwwjwb0", "spjMFOzzcfg", "fCyyCPZbdm0", "ZlCB6IGe-_8", "abuoxtckrGU", "TnTeRvVRWi8", "oXipa9iTYtg", "fU8v2DWn7_k", "q22dY6EzDjA", "gm1qdmfXV0c", "e02MNzGvoCc", "R83AWwD_HUI", "2oHwLG_EM-4", "TlkFGekVLZw", "oD7nNTz3pWg", "wbq4TTRI5oM", "GxHECBUfXDQ", "AziI1QywycQ", "vYhUVWiGGIs", "-vll-c6KxJw", "ZQAOGxEnxMU", "YV1k8XoEiEw", "weNbHzwHTM0", "5_8v8dNqg8I", "LudMeiu8eoA", "gkxuOFk0b4I", "7UZEHCU_LlE", "rsKJeuQyqXE", "i5QufgWnfzE", "gx-q5Sog-dE", "GmZwSeF20yQ", "cb3OBm1dZl8", "Hi5YTU3bfRw", "M82VRQ9bDkw", "9XQDEcD4deA", "dLkTsS1Ri2k", "r_DeOL56L2c", "DCQ44MG-4g4", "mxupEVSP-Yo", "V2nf6Px8TBQ", "S9E0o9Anu9g", "ENG_0UWW-7Q", "b5umTPxJhcQ", "c54BiCtyGfs", "LelxHqUuntQ", "fvCKJvMABE8", "PwAlWJQ9BUg", "QQijLGgZG6U", "1rnHEqXa5Gw", "zIIm5BhpC3k", "4qZxeHB4gts", "crC1gpEmw0A", "NjdgP4jgdCs", "lQ-c2iBZtNg", "CoyQzQP7Oi0", "IqWbBwI8T4c", "l7yPPsBzhOs", "nIGlFtIFSm4", "zZsyJzFkONg", "PE2w42ZLdo4", "UW-RWdKSogQ", "LhhlVuOVLk8", "4JM95a9McWk", "C-vErCKBFXs", "S29C1PBlh_g", "Hg9PymwXt64", "Cp_egyYF8BA", "9A72qqln1Ko", "_fMSFG5xq-M", "EwYxDYqeKjM", "_icLSkN4K08", "F7dILy3uOMg", "XPk6uLFB5EE", "TAR3kS_E5fw", "u0ZHyNbFteI", "F_kfSE3zgic", "KXEqdR4YZ4k", "lmopHkLNN4I", "-sgUrfuVYv4", "aUi7JCKraA4", "YE7JKQVZ5Ws", "RjJqmeR1O78", "_oRkz9UYzSI", "fXnnPdZCRVU", "9NHp2u3D_Ug", "S3llH8S-aak", "Gck_7U-iyWs", "ok1TovgWbNc", "6wbQvi4CC1k", "45-RZNGIN5M", "0EMVnhbO_qk", "F2ARuMmpNKU", "M_zdyW0ZI9A", "F3zdIpKNyhQ", "-XmhBBredRc", "6SkOFl34VKA", "U6S-wiqU6v8", "XcKSJ8HAqyw", "Ri5TrOy56V0", "L-akLuq4VsA", "Ccv3RT7CR7Q", "hkx2hKZ_hOg", "N-Ch8lyKs9I", "qRvGLnjMbUk", "yTKlf3hH9L0", "eRZ5XH6-U0A", "LsK4oGUMpXY", "Qzy01KT1WwQ", "XQkBHgjcX7Q", "oceRuXFnLY0", "udAGW9zGIlw", "-IpXhq91W5U", "-xxXTcPUcKM", "ODryoia9osM", "YgXygw82QSo", "DZOCvengSCg", "Ql8Q4XsPWbI", "8b4ukNH8Rns", "nvzvKInk8ns", "A20-Ew5iSBg", "5VFq3BTTXo4", "EMFD3-GMr0o", "GnaLqwxq2YU", "8gnR3KtZiKY", "lpCRkc1vIyQ", "uVcLiTSSApk", "tu6U9y0qxII", "iM_-FaWyf5g", "-xRBEolkva8", "YS4hQ0cJQPY", "SD-8SpuviYE", "pGFaTOJA5wU", "NuQ7jHSUkIg", "cJ2bFy95-Qc", "BU6fFdFcNEc", "aX0szjn5m5s", "yxHDI-5PFPg", "XTQmbd53SUk", "I6bNpp_5v8U", "l7JflEYsbt8", "8A7g6zlgWQs", "XbMU9d3aE6Q", "iKtbpr4k6E0", "wxu5RFqVPdU", "pT0JMkoTCHg", "wLco_CZLjYg", "vBbesy1fTqU", "JhrMvfCSyoE", "PedW-NNqJ8I", "r6awOHLDfSI", "tw0PE6GTOxM", "gxhqKuNbVR4", "93taL21BK8A", "x8bG-aWSRMg", "C8SD3HC4bo0", "EjrW-frRNhY", "ej4KfmnLiOo", "W_NuXlO-Nrk", "7mM9RTRGcFE", "ARrLuCHGxqo", "HXn1a2kDTeU", "A3nWeS0aHV0", "FJo2DqPMiQs", "Oxj-R4NJpNg", "SKy3bKiBp3Y", "ocUSvuDhnDA", "d9FBaqdgvr8", "Lh_H8JRVLGY", "W7RSrrXurK0", "Acbg5InGxRo", "VLo09eI4r2s", "Lh6jd4fpukE", "KWlCI6jhJbA", "c_Wntwppt8A", "n_HS79LhdZA", "bXyzvwDLuT0", "MUGKkzxuWPM", "yjB7oxlyOZI", "lqVadMMMP64", "-cUjWmkMWDs", "aqA-DB2i2E0", "aWraKAQGTLI", "_wBSjPImT1I", "YJJq7OMQpFk", "omFvotpyNVQ", "--v_ARNP3I8", "WZJq0CvUiv0", "2mo1g5UzCxU", "TnDJim8duSk", "8w5BNnB6bFQ", "9JKMMxRgq3M", "noe11j0d5a4", "WtVTTXLPDCA", "IDgbci2AArw", "US460pNNnCY", "yHbfan4Kj2U", "b3MVoX_f3ow", "RSVarWkG7uk", "3O9uY1MzTn8", "V9_xauOOWcw", "zZabdyL6PV4", "feo2-9HDmCk", "f2tb0kFcZ0c", "iX1jnkYR3Ak", "OE-JsAbiDZg", "poiF4SWtKPk", "MW5dGjvDIXo", "h0wh1afkX6k", "ksM2hIB04UA", "hJ3qXSOxw3w", "AHY_ZoKnWYk", "qm9SUqLDz2A", "w2q726yX6Jo", "wqztwDQ7eq4", "5PNXMQ0TiB8", "ICiHvhBHCeg", "YwSMHpkWjUA", "F7Ox6IdS_gQ", "RCfq4NA13Ic", "0fiZOi5w4mA", "YIjuIgG_7Dg", "b4NcfHO7iRw", "EgKjwMIa1I0", "7fE7B1wxdS0", "aDzlBD7p8Ks", "5RBj80RA--c", "-81JztifUK4", "nZrPqEiflzQ", "85vW-VGQs4M", "6C6d4LioHkA", "6K1dnzNVCkY", "zvOnKBgc_x4", "yuWaFVK58mM", "N7gCvaQ90jQ", "Y-fVBMI6xnc", "yQxqF6JH0JI", "Jodsf2i_Q3o", "1_0e5R1HPT0", "4qiHt4vN9aA", "MkcODX9cUpY", "o75sJdh5TtI", "usZDdldl7yE", "1_Pm8iXsLow", "5c8ZG9ugvYw", "oiTnZj575CM", "6mIHweJch90", "_EK_OMS9KSw", "dNvoEHcHstQ", "ViU6lWXG9PE", "lu-18257QvY", "d-so84TcqYE", "YyJ3blRn8w0", "8uCoFrM3BXE", "lX-qDO1eNNE", "ARjXOILrW1s", "-s5DNHMhyt0", "pQ6yqgpP9Zg", "LinWsfykoCs", "hhwr9WawvC0", "mcRi0krRJ-w", "XC9qvC08okA", "X08U2q4t1As", "uBl914y8lQQ", "IE6ejFHxWRQ", "Yj8M2C6JtV8", "yBVkwK83-1s", "OevUXF_KCu4", "KNqv4QP8-ME", "tG__OGxbL70", "_p8yza8nYPg", "pWD9NSGnTUg", "XeRWDHeR6dI", "c-H6sKnVfI4", "sGPSPYEi7HM", "qf-g1TSHMWw", "8VU8Sx3WMfc", "-ZtsBltbJF0", "ZBJfKnQKhmY", "rX_XhaV4URU", "49iIaWWcI3o", "by4-9S1CFsE", "2Vik2lLphg4", "4HiCYD6DbTY", "ClwavJ0Mlt4", "iOqSSTQCOdM", "wluNvlkG3kI", "ew7B9Zx4Erw", "-RTZfySedMg", "I35goekBwMo", "zopQIQLpCr4", "ETfSl-tRllI", "kLxNHN_3HVU", "r16gWVwpVB0", "fQwBg6OgtQ0", "lAPeomvl374", "Co_iJ7hqUoM", "S4qL1L878Ss", "Cms0rwj6EeQ", "1JqAgcS65Y4", "D-1Gufl_8b8", "i1WdFgX1Puo", "iOJcXAre7CQ", "KaOVBS9Bta0", "uHwB2TYC0ZM", "6YuLYgSOW0g", "2sJMzE8eaps", "DSwuPrbq6d4", "sEpysjJRODE", "0jShm7zIvfg", "WBgH_CDjuJY", "ppoHNOgwUvk", "OgbGX2CdMZc", "I7LAaUyiMOM", "heiSKDxkSaE", "yuSyjb20dw4", "YU-SuG2-A7k", "e6TRGC65ABw", "nmNbsmg28JQ", "cmPqCp9Hs3g", "82VMEQGn3Rw", "db_Zl5aDkgs", "nZ1_C4q4b2o", "PTeqV5ePw0Y", "1K4KRptFJxo", "bKQZseFIPCA", "b0HcSgurSnQ", "EH3th40baFs", "5Q1xQKQh75A", "IvLGTf3qTPQ", "sMht7u1AQ_g", "m03Yx6KcZWo", "m95SF3DIA0Q", "IcFdlZzFXHc", "ii5Q37kMH7M", "mCG3Q-pkTVY", "QgN7ckF--qU", "hJeGLw8rK1U", "vg1HDRXqVac", "hi9UjnyOTGo", "_NvbKvP4_Mk", "VbzL3wBcwac", "ssHgRUMQcdo", "meVttx_6HhM", "cGI3iZWvAE0", "K980K8NyRZ0", "AUpERbZkKGc", "V4B9uVwlaiU", "aB61xoSAEpg", "AZp1KEpdBt4", "GSto4UrtINE", "j2ZHi7imnNM", "ov9t4YcF8Hg", "zlHs7Ed3Bog", "sHFSB8QVJUM", "2aUgr8wr74s", "OoAaABoN2v4", "iN2LZUcjJSs", "pk_CnQyLlCw", "o0FY03guNwc", "utcaMm974rg", "lekvA0AnkFE", "w4luMcf8yKg", "8lI8BWIwCWw", "zQ7QOcGoyBE", "QEHPWAZrngE", "OP2dm7isHvo", "Za3RuCEWC28", "vGa2HTpnXEo", "kxgBdaOgySU", "8H8h4piqAfo", "bHJI-vinD8w", "U8PAMhIH_NE", "RRpdrBd6WmM", "xW06Xqr0jcE", "zyzrbh_GGm8", "HbrGpK4E4uM", "H-oJpw0R_1I", "B0yKPU5W0_E", "KZDi0IVg-P0", "jtWwSNi975A", "z65dbVab32s", "UShdyX0WDGs", "IomcgdrdPKE", "q5dFBNXbsHs", "ETaq6_NOOMk", "GHzZJO74gMQ", "XJycogfHwfE", "3Q24K1sJ30w", "LerkZkKn5yk", "qauSL9mXExM", "iHkHlouN4CQ", "wF4eVRsZsnc", "rkF-gcoRpCg", "adgI1TB7Pn0", "dBQFiqYzUiE", "747Nf63kK2c", "XK1pL6aPfK0", "D5wqnDQS-7E", "KSqx8rxolmQ", "JfMuDIF8vvg", "aoibXeiaJys", "YvYye3cpD_4", "V8IjmGhToOE", "VSwId1gLRcU", "ecErfqqeOGM", "Qx3kq-PVwCM", "CMnWsY1TpeA", "Mr99CzB8v4k", "GX6by7pOEnE", "gPCx7tr6XPI", "EYQbVF9P_MI", "U5ZfitdN07E", "hd7ptfsQUJg", "hgHTDIKUcJI", "1xVpaljzx-4", "VO0ZxnYA2_c", "fMFnDWnrZpk", "BAHRQDZZBzA", "dtZTYntQa3M", "rokMm36QT6c", "iRWMyUg5hTw", "mc7AkE2iQ6U", "T35IER4hUzI", "hD7UB4o81xU", "sFsbsYAGE1k", "q9FRt8MQzWU", "qZtjPAFgGVE", "X09bUWhMvyA", "JfkML_YI93o", "3yPygffPZN4", "KyYTHlIq4G4", "WchTWQdJJQE", "J5P6t2qyK8g", "KsTNqA0okwM", "n85yqMmWBaU", "tQGgRZqMHsY", "usVIzMBv4ZA", "8pOz7-JWdI0", "ioBAt8IAcO8", "jULZ7j5mn88", "eD5nJjjNH6g", "N8syH8qA5T8", "S-HAFggctsg", "73ouB1V8pGo", "xODnbmKVX8I", "cNMM0UZ5cVQ", "f42p3nUO77c", "XdchDFPLY7E", "pjcVz77YloU", "IozEr80gYIY", "TG8jVbjBMxY", "ZX9YItzll2w", "rVbkvA8ij6I", "sgnVexpYhpY", "fQkSt_W2E84", "bFJZfsrRsCk", "kUlqTg6Hnao", "LWSpNxT_4o8", "e1GnizBETpE", "z3vue4ObG8Y", "EN-N8m_fEws", "QT7CIPDQK2M", "IlIu5u3ZuTs", "5GdgNzRMcek", "VEQdEJtMnGg", "8Pq0IvPNfsg", "bfivW-PcBRA", "NKx_9AmSDUI", "mm3IS35YLM4", "eJUeLgY7ZJ4", "0l39nijr8pg", "Xdrk_WdZBPw", "8O01ru9EdcU", "nzbV5IdIi3c", "gTR-HZL6fYQ", "wtx3V6joA14", "oFym_Hie4ao", "r1WKsMrWW6A", "zwmpLvvPEVY", "30TsTaZc4eM", "8EH2l5kKaNI", "udqPuxN-1N4", "Zztcg6KfwgY", "0CVp3rmOQ7k", "C7cpkFgEWk4", "5vse8cr4da4", "QM0l4ZYuYcU", "isU9Tdh2rlA", "_Svwhk-FtVQ", "lsG7KZs4kIs", "mB72rQfwU80", "zcphfIVtFVY", "HP3ugXPSMko", "DYqBoAkPpew", "WFqzZscnX-s", "-EkyTyaIoRQ", "ry8BOf92AkQ", "1p7a4VpHsm0", "XcUa5U-VZa0", "rysJDM3x_nU", "CHERl0vRqTY", "190YbJ1Y3kU", "hVHj9RhSDig", "zvsjDX1Hcz0", "gVBH28uJ3kg", "kTaZbTp3wX8", "qtUZM-HkkJY", "Cggn9aeSrk0", "DQ0wtHF_BCk", "9-fWfhlyD3I", "AdU7v_WHpn8", "CVurUlMsSFE", "UMB4IqFT0Io", "h8h7NZLQ_Eo", "5gtTmeYio0M", "CAEoYHDS_OE", "SYGmjraFgu0", "XoStrptRV8s", "yRLuxhJqIZk", "Rry_llD4eiI", "2haw4wm_BTY", "-QSQDy0-vQc", "tnL5gI9OW_I", "VcTD_leDQzI", "PwCieDMEVvw", "hP3tXU9hb9U", "1H-BPPD2giM", "GZj6F9NfQ7A", "xI9qNpGTNCI", "RtwoB2E2FGo", "h0MOci2TCcc", "jM0Ld6WDvts", "uPYfurOvP9U", "0RCHL7S-4dg", "G5XYqN0t_vw", "IFv9GCcwrwI", "iuFKviUyVXs", "CjEvF55_5TY", "HAMryB6DSwk", "3c2AX0nqAF0", "2h6GQRvlxQQ", "reUpRTcUWSg", "WioVnjnbu4s", "cJwwuPMZi8A", "YIjkftML4Ew", "kT0ZHFIQHXE", "XkxUWsbHaz8", "_37sdlGHAqY", "ckaj4Lnr9Mw", "EOrXK0Y2N24", "0DaKAZO0cSo", "tm2dYaLalu4", "cHim9AqQkeo", "4G18rTwFr6A", "0sTDkh_6BRU", "tc_TwX0z84Q", "x-SRfAmpRJk", "8--F1i8KupM", "KbJ93VRlfsY", "pUVJn1EMtAw", "zE98pa4ppKI", "I-A5kdsq9fg", "-jMrZ_U-yyA", "7EXw9xaiIT0", "cG4mMwgloAk", "sBJMr4dJ8yM", "DJ4848PTYe0", "8-yInCY8ym0", "N9EsOffcdxY", "6LtsiUYPeDw", "b3DUTXnwEu8", "u-VsHc23Ayc", "E3ue8U3EJo8", "YpPUA83EwT8", "dd2Yb5sNGPQ", "QuZ8qk8kVsM", "E9dlB78X4oU", "NEcrX9HG1w0", "hqm1N9jC1ew", "CUy6Smf6zJM", "IWjkwQhKerE", "VzKhaoGgf7w", "DUnAbZRgyjo", "Df1Z7OLzj60", "rvWXnLDi15M", "HfiqEXIcgQ0", "aJQDFPkfhQw", "TqwJJbMdCwk", "2a9jd8fu4p8", "6Lv5NnDA5g4", "JjeEDdcnJ8U", "xIBrlkRrpiY", "JU0QjVV86AU", "GxejZ6H1oOA", "xIquabST0b8", "6BXMrJ256Vk", "o2NC5WSI1eA", "5dJIUX_a37E", "IOUxJKp5zvg", "uDnr-hiUajY", "ypljXBb4xCA", "tMXQGld-3Gk", "HqNlvuCGpJE", "uEE6Ob7f7r0", "Yc5hvSZSB6I", "KrDVwLfRNdk", "KxnVZ4JeNz4", "xTsBqkOm7tY", "XwpW484Rokg", "P0eKe4y2gHo", "Q1WOHL6eSD0", "S2QoK--hpTg", "--1d5M9A7jM", "hn5AZEjmpZU", "pHXzM7LjIR8", "75gx3NvlU3o", "frIuQMgUqKE", "9ZBuVLfsRG0", "nKXlOcYljBc", "0zmPUg7Pm0g", "MDjDa3TFnw4", "bw7FQzalwK4", "Srw_qBluqLo", "sMFNF_DlsnA", "PZPA51ehgF0", "_uGafGGaGBc", "FReG152XQ0M", "kHQAt6v55Ks", "OzYAQbXhWng", "2hBWR-FGdIk", "GxvB0tA0x9s", "230ILZsy1ww", "2hkB_ffHsiU", "FC3_Jwum22Y", "d77snMh58tc", "nt7doLTIF6E", "bjMryVD6Lj8", "6tJoCfoEqcA", "sFy_GiMwtCY", "DZaKj12xooo", "pmW30B2o6I4", "J2b8-lKupdE", "ebZoFZclqI0", "6OCB4wOzfBk", "DzCG-EegjyE", "_2waNM7Bda4", "YLLjTlqJZrA", "QPPbOb1unn0", "rkdnj3WO3Js", "X1wChdNne3g", "_FJ1scvgwFM", "g6Dk0x5c9w4", "epnFy-2m_3Y", "NHzlRBbPa54", "V70prIpsCrw", "Fiw6CExhQys", "MwHcLUeWl7s", "5TlCLksWV58", "Heigj96WDW0", "d2jTWoMKY8E", "ulaggr7t6a8", "UJnxc3RbhYo", "JO_OSySQVaI", "rh5v5C9T9Vs", "QSjgeQ7SlZQ", "DYgOQ_UaoPA", "SSXON0frrCM", "g70FU3-xIWY", "m9BJAMw4tMg", "iQX_wXoKopc", "sg5U8w4xjdk", "SMp7Qrv5kGw", "evEnoYs6Z8k", "K362pTjRifo", "X7MOWXjcBWE", "LE3EcrqBNug", "EZjj9XDpxWQ", "JttkXM175-8", "XycCm1RobUE", "_QedMWeUGyE", "Uh91GZtA3Ns", "OwRpfq6hk20", "LG-L6lLZNzM", "SvPgOYjTXxU", "9-FeTbs46YA", "HvRFX0qZvho", "msWnTuvQSs8", "WKovlXtdFGQ", "sAiwPdR6dqE", "HprTNHjzc-k", "z5je6X7dpEU", "GTAhUnWSDzo", "57mz9CVzrVc", "3KIjzUW-Ns8", "fpO0YdLEso0", "vmHc68EHwds", "B2qqyySZ1tU", "loz6OLRsIoA", "AjL1UHYAkT4", "X7bE5X4Sf2s", "7rjWWLTQ_Uo", "PGnWcn90nT8", "CFh5wqzKvzY", "fdxqHmfhPf4", "9WwYk8odv0I", "jNVlBgNzUzY", "_kcG9DZzVTQ", "N4zB9yE1gMo", "iJk_b1MHoWI", "8wbb-oh4kGc", "M4ufvA2Adhg", "G62lVVzRmDE", "JrA1KrJn7ao", "fFHk4uS5yTk", "7W2tnNe1Chk", "41xEZQCaq08", "l9Nv9dt80Ek", "62dd7HBHDtM", "3E86Ooz3k68", "KbEThaZinBo", "N_t7hSyS_xY", "KkDB2G7tEug", "VnQOBWuLjEw", "eVp6huPcl3A", "Rw0nD1fFZqc", "rvQ7NNcWX5c", "1yfXb9blsoI", "UctsBSxKGek", "jEd4HGm5Sk4", "rqXdaPJmSmo", "JQQ4lKbbll0", "Vqgi40NeKf8", "kBecAuWi42s", "aZM04ZV5uDE", "Wz7fFbAXnoY", "L-wG7qeWQ70", "lth0cFr1hQs", "LoCP1S2y59M", "iIwXhkigxJs", "1D-Y01UiK14", "z1PxmnFYXkA", "p7EgY31OCY8", "aS7hlowJsVY", "03muh5GOf30", "GP_3HqF3ybM", "X2P1JMTwp88", "eqK74COgF4Y", "9Q5r-obU0iI", "THOfoNA-D9I", "YuxIfc9gDN8", "OcKbPDqpVbc", "1FMGNFYlmjY", "LyyUegXFOH0", "S0vsstAc5k8", "kOQBiPmVBNs", "uvhUfcKJR8M", "iLRoiansTd4", "pDrksa198gw", "vouE8_7zpOg", "_928dL3cMaI", "rRggxGrRdmk", "7T4WBiLZv7s", "b_0MZKTPUEk", "QPNPusqAx2Q", "y21MvJ_pC_M", "vKNQmlBtO8E", "O3F34kduy-M", "Ot1tM6-ezWY", "kslyAsgUKgE", "_FYruLFG4Uo", "iAZDxCOF6Uo", "ViQOIY4iDSw", "b4LlfX7KGsk", "x9he-dZjf8w", "b0MDEXF_p6o", "d-MUHyxDJLM", "1Ve8nWwnIMc", "CexZ3HITqa8", "aW0I5f3wvXU", "lm8YgWBeQsc", "5tWcVBZ2jUM", "bdLK8-I3Huw", "DBkHmfpA954", "JTiKB0QMoDY", "gNAgh52FrhY", "4vVS9jEeziU", "jc_qXIcqQGE", "prArsB4jdp4", "6MKbjdEPWkE", "YuNNNT8oQhg", "D9ZnNQVsPb0", "zS59iMhSDQE", "nhEXHi_qoYQ", "ryCgbs_uO48", "MQMn2MIQaNY", "W0RahK1Ejis", "w_6urAi4pQE", "eV_cxbUUfDQ", "7Z6PVYfIPHI", "kRbXsGspV3U", "nXiN_xMy6aw", "eZXInGuSzaw", "n-9sW_DuHqc", "WgOUlHF820Y", "A0AoGhyZTKg", "Em6s7yWq0OA", "MBJ8yiAWxvQ", "14O1jSN422U", "n3kwf8372pE", "MbgFIdVLqMQ", "COFeTtUcp74", "oL8Cg-fQRV0", "-LESuuPMptc", "02hmGSHdmv4", "dMjF0Gx8HbI", "9tBY9A1KX7M", "S825zL_2h2c", "AIw2PDs4_sE", "FdhPzArD8Uw", "hKcRbN_Vh3U", "97UTemGA7aI", "e1Kr0LzOfbA", "uj-9eueB_5o", "CnM2Pbpgp5o", "kSzrvnKQSMo", "AdkVaY4CO4c", "jbOcivk6Rcs", "ZbD7Pda9pC8", "pKSao7hYOGo", "_9OLcUY3TrQ", "EGvhbwJMfUc", "mxikmldwPjg", "LbjEwgbJTb0", "Ktz7hqgQIbU", "cWTqIFdKBaQ", "5QuDRZmyPn4", "Iniabsf6wdA", "srPObXvyTb0", "QKwnqI1f1IE", "wcljQCT6bqA", "dmTumYXiVro", "DF_SAIGRxmg", "h2hyBYoqj7c", "2w_uT4vuWQo", "aFCYPtJLVE8", "N02MzuEYHyg", "cfKMJPmophY", "EZvtKmP8AWE", "SQTfPkwwvzo", "G8A5WT7B040", "Mk0Qz01Itvc", "msXwbYI5n8g", "AMRNag1FZMY", "sby2038wWSk", "IVoexa7iq48", "oxGJAqL40Og", "vclacDE_GPU", "cb0E2VeDH7U", "WmTijDumYLA", "RIOZeH604zQ", "ekv3dm36o3Q", "QWdMn_w0PYQ", "tGCDwlM4y1g", "zbiVLM9FxrU", "ZlI7VNCBb9g", "jvk6L92KMKg", "Mmby3n-qVEU", "8so8vmGTSx8", "2huXxN63uSQ", "S4793X67oog", "5IZMeqiDT8M", "9Y3OMnAo0wE", "uJ1YKdWnLFg", "yJDqxet32uw", "hT_U4Fe4KUY", "TTqeMNwKKgU", "teib2MOdhmM", "iipp_GR31AE", "DHyhq_RAXzA", "XNAHk88PKJw", "w7xEdL9VkBM", "HC4OVeR1QRM", "AdCH-CDDhFE", "r3f7PFhsNN8", "02kc4VfcqYo", "YGLbQGxZ0u4", "_4frPCO4OS8", "WOrmFQAlCLk", "STUXL2Jfm3g", "2MlJ8lro0zY", "5bGORk9-TTo", "ls47EheIDwM", "t1mtUUiwxv4", "z0ovFc4TBCc", "3soTA0bM2tc", "H1Au0Kf5x-k", "PuEy9xjzoPs", "hWZo9BZYwtA", "NWHNbefC3R4", "jrkHeykiWhs", "aJW9zccIpbI", "BSa3gunwNOc", "2H3hT9H8i5s", "-khUnjpyKb8", "Knofeig2mGY", "YZOsd4jAfO0", "00cAUUcmA00", "A4Mm0sdCOTk", "Q-bRCOTSQR8", "esFtWllPyCM", "zdg5JY0hAZU", "rO3gXXQxQT0", "WKMoLjCeqYE", "_RgJvsupxJY", "cidbeG5E6Aw", "3Afv-0N7Rkg", "lw4-ujZeQUY", "YnTfSkvyqhI", "Tsg9woZqUTQ", "KfAv9Zz3wmY", "lTZHA63twvI", "gvgrAu15mps", "sjciWcS-Qkw", "E5-aT3gLBuk", "yB9BUfhCaBI", "mSs8-64WnZE", "svDShBXAQKI", "peRdoOyARRQ", "LNaiQWF7AEU", "V3WTegF49xI", "OWQAoW0O7wI", "8kApJB1rqV8", "KdFThDut6Kk", "CZon5KW1WBU", "bxEKDdq6orM", "7TjHX-O8uao", "6dHnfPC9P1Q", "H3WpyVQl-Uc", "ai5i4ZIvMc4", "hSzHHB6b1lA", "J11W4yTeZS0", "jOgTVWqjNdA", "Sxz5grTlKVY", "tEBfUBfdW4M", "RN-JzpM7AYc", "u-lETA2NwoU", "vLdrVIhM7S4", "dIfQyYU56ps", "Evg6A98pQkU", "cjjNRV1do9A", "qBO3MR6liyk", "OeAxGeXj1qM", "xVuL-Lw5QZw", "KUNiNmsrIAM", "zjPaQr213zE", "yBRPDLuPVlE", "SRdJPi0H2Fc", "nQ2h1q5E68U", "yDqi4-W4RIU", "NuM8LQcEz1c", "soEMYUkfIJo", "MaSDiT4Cpbo", "IZH2pPoJNw8", "_oXmzGsx-hM", "XLylpgXIx7w", "Bhx4_TCRHV0", "Y2dO3eibiQ0", "MOcFO4rAlhw", "aiZxkbqNAsI", "GAQyO8Kk8zo", "-XEn7Z18jbw", "Ovs-EpkONxM", "lI4MGkwRE8Q", "GRfXGf0pmDY", "J0NGFIo9sTM", "tEGcPQZ7p44", "9raeRjtwMc8", "pSIqd85_lsg", "9adNuPNhihM", "ivzc-kZtzR8", "dLkwEycuakg", "RrGvdRVWg-c", "E8gMT13MPu4", "q4jYopgvg1k", "NrSXVXLcsd4", "WCBu_QS92D4", "r7c-jDaL7Pw", "SOEEza4KVyw", "UCMHPp8tNKk", "enp1AJlWIOw", "MXgAogH5Dzg", "VQV-M4gsc0A", "CZ81jv2vj1k", "kABBZ4iyGZM", "H6LXN7BNCIg", "M68NZC9sIWU", "PH8ehcF9Fd4", "WwcULLJ7sEw", "YAvW_fpsWMU", "jvcIymBbFiw", "Lgr2wsoc1Jw", "vXMxBNOYVZw", "KbWfXSCPIbo", "-h57Ewbv_IM", "JDI0aHX5W2A", "5-AJtcG0Gbo", "tKJKa62emPo", "_X0KPiuQK6g", "KLSuLIKCAEI", "DZ6d2jCe3cw", "xCWhn1ba8sw", "bXjJ9Ax_88A", "j4dUvahCYmg", "3yi2fUFP2c0", "Fyq5HQLwEds", "KK96EE3TGQw", "IGegTvHAiGs", "tmJ8MRHOzKo", "3obSYft7b7w", "l64NpwyoXAo", "LGD3k2eg5-w", "WoymFaSuB50", "6AUGtavcP2s", "X-FBTlFqFPA", "azuWOT7UMH0", "sudqAiWGe6w", "Ha859z7pSOU", "M-XQWfEZ6dw", "tgrcBAYv5qw", "MpaZbn5Vj10", "2A84E32RQcA", "LFs7TbYnnZ4", "TTA48nsIoYU", "_TmH7bq-S9Q", "JDnatBnpKjU", "rCTmlB1BQnw", "OUVl8pG-F5U", "4SNs3VQvKLU", "Y7ZhWJKiLhA", "5zkQT_Pbqy8", "hK-7KWfqBzs", "MMbdFfnhfKU", "tqL-0AQ-8eo", "IJVPFfCphoA", "DZPhGwqXxyk", "eBhEtNlfbFM", "rkdMdK_mgy4", "2xqGlTYZuCs", "fdiRcpHWiao", "buWEmfimCro", "K3hRkw6MJAQ", "VUKTwaUb-fU", "NEOxFKzSKYc", "bO3RXuWEcho", "WeKr6gUfNeY", "EfppjhAgRS0", "8Ar8ztTqiyg", "h3yFVDwRNG0", "VZR6vU3FcKE", "bUpNB0yArvU", "roZGPoDgssk", "zndGbuiFOaQ", "YDcjkSzwOw8", "_Nrft-Kgs5w", "J89z6sqlMsk", "Vidh09rP3Ys", "QPuXGhBu3ko", "-7RYov8FNvA", "0rislD45YHA", "a5OrQEsSV0w", "w4vGAqrbcZI", "cQZwZOpT-4w", "YUfB0rDExcs", "53yfY368J4s", "5OjyQPuJGxM", "-MH7QZosJW0", "A87qrRBaPFM", "kCEVgMLaWOk", "wnaiX47W330", "Nz1osohqb_I", "bduT0unVabA", "2X2n2cpfYLk", "3t-1wweLvQ8", "DbhzGC4Hq-Q", "UP9LENUQsLc", "S0h7mrBoAao", "jSHNrTxTLaM", "ku6Y0go-nvM", "kA-ihfGlqsU", "EclDhIafXsQ", "gWbCcXaIxSA", "Uxl889mA0uI", "ng_nkFaKcHo", "UFSW551nn2c", "idQ_-YttI1Q", "wWs3Q0A5krM", "h5WyAA86pQQ", "A7PRrbDiJnY", "O22qvw__2Kg", "18DPbQiRBvg", "h-pLLjqR6VE", "EI7l6IsRdTg", "Ab-wxrmpZLA", "JyFaSNZBfYo", "Z6xcVoDoabk", "vNRghpXDvIA", "5leR0AIlt7k", "D0flq6EmZQM", "HXdUHbS7IE0", "LxiJPcHDEx4", "-TNnf9auMHo", "k-BCDSTzwrs", "4ilIA14nwHo", "j2zjohbep1Y", "2lI-ESa3Qoc", "ai5h3CNsvk0", "X5L2b9o2ec8", "Gl_nLPLXr1g", "elcFwHp3jhg", "F9kmwhfhwzo", "o1ZwJ2seavs", "wtf5wbTtZ30", "y0x3AJSm26w", "z9D6ZWM84A0", "usqawHPKXv8", "8lh6US2y9xM", "FHg2o5c5tks", "xtDmd_8D1SQ", "4zM716Hfy9w", "3jxR4xGEpVw", "TeQOkMDBVak", "Z_5AwPmVzrw", "es6em2hI4tM", "mpJkYYvY8BE", "tux3lPcvyLc", "3VbQxO4_q60", "TuxXhtQHATc", "O4MhkLz7p94", "eS8tfhQko6g", "tqhl6DLP0qY", "Kj8SWcuIyV0", "wQDkBuMevXI", "IYjz8AeTsJI", "MOxFXeeTLrU", "T7pvJoHxQzM", "cK6niKF_FOs", "KOCO-qRd6fk", "bxQ6NjPUuvM", "R8JWgZ89Alw", "bHFYOrUnzmY", "FT6-IzUBW4I", "neg_WVIdgnQ", "0wcCk1o7CT0", "6osSqkCp9dI", "P6wKft0f_TE", "kLia5bL9hE4", "bIWutMjB93Q", "OlpaU52uIUQ", "YNAGzDsBwLo", "gq2o-HRLLT8", "RctoaBPg2DI", "ACmf6Eja5ao", "OrNzh5_5Yx8", "V13QiynzQI8", "ynj2CUKxK4s", "ishsg_aYcB4", "tMCJXTR7gsA", "8KZAsKjsHz4", "jx28JWESRkQ", "2NL8QROZylw", "n7EBZeE3LMs", "rONdBVOky9E", "e21Ae8qpTOw", "wBENlg64ml8", "ZihZRAKvIe4", "3VZbMKeY97E", "WSH17_n6gF0", "71tH4c70vQY", "7ujdaQ6Z9DI", "3GftiRraSfA", "0xJQUGQj9VI", "47En4O-rEpc", "PrYCKF9bBQQ", "EeXEaSruRLE", "-Mogi5aZ4bM", "3TaIYxjRypY", "cPM2gBTPRVM", "vDOc8dQ3O2s", "kkyS81zBB5w", "eYx6i3fehfw", "wmdgj7RdpVg", "rwH0geqeKZM", "QthvIyq0cNI", "kpAUs1L8zCk", "J0mTy5TGOSY", "8p2C-EU_FS0", "fzdFBQ4vWj0", "hF3wn6hT_34", "hcOz3EcqWgY", "YL-9oGgdT_8", "HWSoFeNiJys", "j2FWlujfLT0", "hDWy_wU_mI0", "lq4SPvCXGjE", "r6kufsb79fE", "KqYAcLoc1WI", "8fqXkhFI0MU", "4kLMfxToKdM", "MLxqsrtI5iU", "EHPUsLIfGQU", "Svo-XV0yd70", "6wZnQ0X5j5Q", "BpYNfL_XLCs", "EgrYM_RSyHc", "DkzeacVnBtA", "icxifY66mk0", "UPPrdQpYlbs", "26yp8X5wrz4", "I6mNABsROG8", "XdW6Hgwuq-g", "HzkCRa7vHZo", "fpryFO0u_u0", "1HNBMUiNvok", "VPWeIi_BJD4", "yIYV-BR8Ml8", "2yjuspXRDFQ", "YtoXXxPtu3w", "obWLt5BcgJE", "wOVdWqF5A4Y", "thN-x8RJIgo", "-ZQ6wmjbLcI", "XjoC7XY0Am4", "Ex7iktOUf6o", "F6x_tKdiSiM", "e8-0lvUL8d4", "FXTezojKIEY", "UYsVYFPQjZc", "0fKFwYia0kc", "MlTkVlIXCkE", "gi7qLr78oFA", "dnVWwfUxHs0", "1ES7XsyMPGA", "kx1JUF2AUHc", "WBXwnSZUOYo", "joNiiaxf7Uo", "vuXGCVIgyFg", "It4GZp58Oio", "d6hNLLg3a8Y", "HQJeClBd_Fs", "7JtSU9jIg9k", "gfkVLAuqiyk", "e3EmfA59a6A", "XcGrsBu0Zzk", "sVQJZFCsbH0", "3Gy8cXb3Tfg", "Lr2PSBTfarw", "-1DpJ9G7_8w", "EZxo4zyFlCA", "fYIx8YhAt3s", "yOzTuY3129Y", "znCnTbpmqMU", "i64rU3zzRA0", "Pss2a-zNCuw", "aL8axS09Lto", "R2V0-V0XL7E", "nplp5_iXH9E", "cjFcUHYOtfg", "7QNytUIoGGA", "v1r5BZqU9so", "krs_A7suBzI", "tMC9M49oQ50", "8wBHdPRm9O8", "-WlJkqKPGGU", "xAWGOVWq494", "ghQtda0lu2A", "VweeHw4z3mA", "vPhsaAUFWNA", "v_VBFGxpb58", "CNE7M8DmkQI", "jOES9YMvAGI", "Hyk-oB9CmoQ", "VlkHoKgk6cs", "CYUm2ixpDg4", "qIlJYWDLIuI", "PKHd20GAb1A", "MRbnzuBhxK8", "U0w4GIPvn4I", "hmPN3oYxDOU", "9LG0vky1gLs", "njGbLQzhOaI", "egapkeF5dyo", "YFOoW2Ds5JQ", "0NaI0SS664U", "gp_OZVqE5EI", "rILhtkOFuWw", "1inDKTHh_gg", "sK0TF5Mt0D4", "5E83ThOtTmA", "YsHbTHNR97A", "B0-fbA4CmMs", "y_SPfbt9MbU", "NeT9TyaClDU", "j8LwmKEiCaE", "slWxV6tmH9k", "3VKASxyGZv8", "o384k6PYGhk", "vXBr2Qhdh0U", "fBBcLzGtB8Y", "Ktv5CPLzq08", "k9oG8JhiBxw", "eag_xe0jnVA", "SPD1brgxCU8", "D0lY3PknVZQ", "XzN2D2gbfgc", "mGhkgNuWFXA", "8U1Eil-DHlE", "BbS1adSdklo", "Rb8BKJbZ1gM", "7lOUf2MOUvY", "4K6sCG5W3es", "KxlJWVtqDjk", "Z10YwmEsYUY", "6vrz0tWahjM", "6i9fG2jnK34", "W5lSKR1OaS8", "3oCE6tUOfgM", "JR10Fi0Airg", "1lFnaHkf_Tk", "7X9prqt2O8c", "pLWxgt-9FWE", "0o5Tzxa-mnQ", "VmMu_aTAWUQ", "KMSIN9ACzb8", "Ai3JUinG5F4", "uQI91eBAkOE", "_GqeDB3P1Yo", "xATTMbmCqXw", "5Ldedwu_xh8", "-gTSRCBXT_M", "rgJnLq2yUTs", "Px5XdAmbWFk", "em9AjToQ0JQ", "1Amn-bP4j6E", "uI923Z8uqwY", "Nny3XscRzqM", "V3S0RFw9dwg", "sCa3L3HYpTk", "G7KL8uKa6zU", "OldpAyx0rkQ", "RCBhnV5wwJk", "J4xdOqbxw6A", "f1gXWUZGVhI", "0ILrCJ4kAhg", "ti6TBcWh5zo", "lZ7mYNabAgw", "XRNE92q-aig", "3-W2iyljUME", "1WtMFuVgiLY", "J2ky9f3kiMg", "x48_HOZlsTY", "szRzJAfaDrU", "PTJvL5GUDZc", "1TwI6g_3cwU", "eeCiAXr7SeA", "Rq3dQ2eMBSY", "0H_qRHeqpUQ", "g_dvQybLY80", "pHuH6n-SzwY", "pbG5XNiZD0s", "Tci6AYFM2NE", "XE6rLqkHdgI", "wBuleGJZDwY", "O01xa7ceXmk", "9M08xaXlT7w", "a4WXb0-yqwU", "uImwiFYbwT8", "TEAX6xtkcyQ", "2TnJiU9evgk", "W7FxQceeilI", "WSfYfZNuo1k", "PkefDUSNxtw", "-YNriE58iPQ", "2fQHn7FX2Zk", "GF5_o6uS6Vc", "h7ZNSsvA6Mg", "SgGLyxvCCso", "Y4uk706jX9I", "u9gtF1XzCDI", "yOU7X0mAjGo", "n_gSXW8SHYI", "X_-RDYhOZ2s", "ifS4a4Y1jGA", "WEpvzKOy0VE", "O78ZC0CK2l8", "7CTsy2zx40E", "OgelNobz23Q", "DLvtksrtOfw", "iW5QW08BJ3k", "hwQP9KPlBSA", "dQ7-cdFpv4Y", "lVkcKqhUNCU", "puT5OpcEfIw", "ZNwzESAuqOU", "X7h7P30TkpQ", "u9dvbmTAQTQ", "6i0t-8nDWTE", "ZpLdGPPdiwE", "f9I1jCSsxYU", "jxTQIl-L4Nk", "7I8xiZAyhSc", "JY8lmGJ7Pm0", "w4nDozLFDi8", "YbTjnJpDb0A", "2TqxdCYu0m4", "yKnaCHjQQTE", "WYgJRiRNc0A", "zHPcW6KBEnk", "Tu71A6fzZRk", "DljiPBxaHqM", "I_218Xchcr0", "0t-uZYvhZjc", "DvqmZOOIDHI", "rmeYgOKrE_0", "6hFckCAueO4", "zLeGPGL0x3s", "aKFyx-QaVR8", "ihDCu3p4STg", "kSmVd9DrTX8", "2hsa12Cds1o", "MGkqfW-vHwA", "4d2M5std1FA", "tmLwpS6so-M", "vlJDBZb4pCc", "VrZ5U2X46tY", "YY6DGhFhZHk", "M17UM2qOY4Q", "-v8jPe4yLe0", "MyW75zltiKM", "kXuneltcNwE", "JmNW6a30D9s", "xOOOAqz4C4c", "PBwCxcx23v0", "qHarDqSEwII", "k9Dw23aOC2U", "FYgzK3_MvKU", "-j07IhFWLnQ", "LbzJ6HSgrtI", "sy0fH3vH_0I", "X5DUppCwG64", "BolVdbldApg", "fPyQHch03zA", "au85_Zob_0Q", "dVQrOa0eY5E", "SGMBqNGukuo", "wZhjSzGosys", "kXbR-fm14FI", "7FE-Rdm7bgM", "L6LTRbq_5KA", "fFUPB0DpHBo", "P3Q-W8VcGng", "3ZXgadhX2hI", "LzuR5O_T-a4", "zCvma8l8IOk", "KPLbo9tK5aI", "xxrQw8hmTbA", "07QSyQsR9B0", "kolow_zbnQQ", "duhK9yC9a98", "ffWHTg7gPa4", "gNUgeHZ4oC8", "Vnkh6-0htgk", "Swdd4qjcsYI", "-74nrzQdYRk", "5t5wx041tlg", "We8Ja7MJG_4", "AvOZiougI5g", "MXpfwib4P54", "-uDN4HYT9a8", "NbnRQkPt17o", "QGjM55bmz-8", "3YP8QVNYchY", "63rBSG9tpVs", "qQLJWapfh4s", "jTo5Sh9J2hc", "JT4SgFvgJzg", "Fy76nMH1uA4", "aphyNsZ6yKw", "9_juBQOWCtA", "jZsO1YFW0qI", "oL81CXgNVJs", "_k53e-sjQuA", "qqg82lsbviw", "7UKNMxbVTJI", "5TLBsJ8TfXc", "yWhgCppDjCU", "h5T3sH4zWn0", "zCBAfklRL5g", "uBND_8fvIpU", "5X95Z_qn1O4", "rXy5YEzA2SY", "QW3PIWIX13c", "UThxHwJCWjw", "YTqoCVL9GMo", "vovghjum0fs", "k3yFAU2WWfA", "pbtqOviSXoo", "KUFjEdevoow", "q0PMM0wiAUE", "8VFoMBQENkM", "a0y5Axe9rC4", "WBqChZrLK40", "dBQ9s-qBp9Y", "QbLrWU0IUAw", "KTLD7g5T7og", "KZHjacXg6z4", "apAZNgq4EP4", "PRFNZNCxiGs", "_R1EyQ0uDfo", "1l4SPGFnRfc", "zBK3dXGcNKY", "1buLxhv0yKw", "gJW4nmN6op0", "-R5O2BVMwiU", "LTqDPlOKaBI", "TpMA1MKLM6Y", "zxN6LSyqYNM", "StQeC0rKN7c", "aGHYZDN-JZc", "0oH3gPL6L5g", "Em_goWBvTJY", "dzcV8OCJCho", "dexHzX4Mf9M", "jn0BgMqqrpI", "-379VwOhGYU", "7WHFoDqlhWE", "nz1h7l69sWs", "-2rKVTAj2JE", "EDbjAUthRas", "xHPRhtjDuik", "G8M-ugQifCw", "QMIu02PRCX0", "wiMOCxY-vnE", "e6yQTcJfQCM", "BN0ZqwAdWLY", "ikFTJGLSSIA", "7fnDHsGuY5I", "bXqTQt8s0ao", "e1VtkLOySkc", "5OjWvyfux2M", "0tGlg2UgPPI", "BtaRy4NNUeI", "fNFpstwnh-Y", "FJ13Ak4ktx0", "t3WA6xKi2pE", "xPnBqXlRBhc", "dObpN-K5Fps", "ZxNz79KTwBQ", "q-JOJ0MDOa4", "q7xbQg3IwPw", "xVVVlH3giBY", "AbPxsonk-qw", "xSV8rHLnQeU", "sErYtIeDBgE", "Hb96gLwFdMI", "KUY64hWC0Y8", "jXzotbF-BSs", "zBnd2_wC81g", "3i5mOIR6UCg", "14uzDrpM6OQ", "Wdvw_jmEvr8", "O899vgcZ5AM", "LCZ7s-XXolo", "0FvJxUK5obc", "KBdDYHtowU0", "ourPX6W630A", "0HC856pPbRI", "OZuu2DnZvTo", "s0eXm-NStf4", "4gjTI3jKx-s", "jKC-Ow9j8HE", "lFj5KUVQOH4", "Zuitcy2GN5k", "QOW0U4bAmak", "_bjwbbhivnU", "qAlj8P54-PU", "Cj332xYAFXs", "MA9Xh9ubcaQ", "_qTnW-FvMgk", "cUuB85zwdjE", "RtaHgBX_WUc", "sXY6YmhU1Go", "PKXIPKM2VAY", "HJW2I5el3dI", "UzrAfup0YtM", "BwpavUSJk6o", "svIWGGsTAyQ", "ahH4bGulMmI", "1rpmW97PU04", "hH8q5suWDeQ", "KjBZjMHSTBI", "INystKLVSIo", "uq3Agkm7LQI", "089rAVCUe1E", "Gpvtcie1Sm4", "njJjLoz3PHw", "XOXh7S7u_70", "q0g9WCIyym4", "fbN_Wvx-uN4", "bkyAi_64XBM", "5tix0Hdr4SE", "QySN43v485w", "vAT27tXBmMQ", "vaqgYTHChQM", "q0qxCVWvNqs", "OAPQRJO6wm4", "RJe2uCBEtp8", "O0pvrPJ5oRs", "qQIrlFvIUys", "N_ueS8AR4ck", "b9cPMYGHrLU", "miQCVs-KffQ", "b65CMlhJLIo", "b_TlPoYSe9E", "qABRMKwoN8U", "HZQFetGfTXo", "D9AHndqmpVI", "gNCCNA98KNw", "tHM90Qzct90", "r_vfWCBqG34", "BikmHaIbRfg", "91zZDOmjK9g", "DYfIbbVvprI", "47rf9C9uiII", "bM1erbQ_5vA", "iL67j-Hy2sc", "la3SiQ075v0", "D4S4Toce7FI", "uf5TPg6Ixfo", "ik5X6Iw38OY", "NJczTJnersw", "f0M7oaBbvbA", "cu1ISHN81j0", "HiKwLf43fWg", "nfn9S-L5F4k", "QL2pZUJhjDA", "VZgQ_B4VqWA", "PRz3MVU8VqY", "a_tsBthoNGc", "aPCHmx2QL0g", "94m8jq84O54", "NgvcSjJNNQ8", "UxIPdzQWRQQ", "Io30x4HYjrg", "cLUgIBSsaF8", "stN9Fn83Unk", "2VQQ2a9CPSc", "-Knsdx0wg18", "uQx7ZxR5F0w", "VAkxUj5FmQY", "xSkTmejhjIQ", "cHv0-fhmsoM", "Q3oqk67XMBg", "8SjOBHQIVNw", "k8jvx2AiFzU", "sh3XVAK28ds", "l7OogvUp2W4", "r0NLyKqoOkc", "qxMJFxBROKU", "40SxP8rIw8A", "xWvnnPhL4Wo", "YsBUJgkK01A", "DANDu1Y5snM", "orQ4QGjqr0M", "1vG1-n3rS7U", "B4IMK13v2IY", "78cqvYEDgwg", "CopRT6V7R8M", "OHj3_mz7lR4", "cXc2aAeYqGQ", "o-oQlSp3Qo0", "fn_W92w1HH0", "CpLoxChnBh4", "0olgNkWd_fA", "W-b7BwwvZE4", "bxDnMYYLyxI", "sjAa_rxBvxU", "ls0bhB2sVoA", "nGFkraxNFjI", "yk69ZfGYWlM", "LxpXidGAuM8", "SF5iGrECj_0", "vfWrGkrFds8", "L9x1rWNjdaI", "bLvLUyRI87E", "OF3iT7Rek3k", "QaQPbgrWjFs", "08afIyEAytw", "W7QNhlI0uN4", "M5YONDzOP2A", "UjYv-NR6oiQ", "ujbk2G_bWZw", "DRdJxKdKUQU", "fBWr-xWzm2Y", "DD89OAImTy8", "Ced97b9YWe8", "KsHBYyLfOwA", "o3DbfMVmxMM", "zaXBv4o9u6E", "dqxL6aqVXVg", "1hr_ADTAMaw", "7wlRL4Wk-vA", "58zpJADN3oQ", "2I6caiCKCkQ", "8_YdJkXoZWI", "5HF7XdSH7jg", "fMriV3G4sOQ", "vlyAO0kiRdo", "XNmFef-pV8s", "0LulhFEYbbE", "36rxO0qmVk0", "IDC2GDwpDGM", "LrxkcBcGL7A", "xBlliiXIkKI", "N8y1-erl0tA", "m6_Mts0OpXM", "Y0cxmPTkrPA", "SIT3LTs14wE", "7Z_Sle2o5WA", "nEtP6MmxSMU", "WprPGS-roDc", "AB16L3MxCSg", "Tx1L58kQtcc", "1HJ7Q7KBCsw", "vFyxyMYekGs", "cz7SMLjpE7Q", "xSttobGe_Hg", "G8nM8TqoqwE", "ePaJWvWsT4c", "CPSpV7b45ss", "AoBBuxHEPHY", "5AsD9yQb0lI", "8xRfQw4PJUU", "iyEvHM9p8rY", "yKRtbOEkS20", "EjOdJ-ro98c", "hrOgpBJJ6R0", "B3F3io7hu1Q", "xtIgYN-kzv4", "O8WpKvj5WAg", "QANqCQliPFY", "VFfIrFoGy6A", "mekYtwpQhi0", "lNpfemDcLqk", "Blyfo9G8hq4", "UDHlQcZCllw", "jKI0igAbwzk", "K3Sa8x2UpZE", "u8TBjlvdXV8", "uTN5q1w0irk", "sSkz7Kt-hCo", "RdXo0kHna5A", "Cu3IwqyXmlE", "oq_YZ08FMls", "fZvhIQmlhpI", "9RWU3sO_Z7Y", "ceSrZZFv_Ic", "QTQ_dmIgVl8", "twM7b4z1G4Y", "QYvIeOCtl3U", "JDPqpyyx9qU", "clpdnvTIbGI", "t5nJMY4QhCs", "5bjrucnAzxU", "YOUmgF7QWRY", "f2bnxUOJ-70", "akO2BgIoin4", "WUmPskUcx-Q", "dBZDCp7QuEg", "n8nj8Ew6K1M", "0m-_x2Cz4fE", "QRv8uoX1xTA", "2fqWRhmJjCM", "vgJ8MSWmQpw", "kIuF8XiNoFc", "uWNf-Ie2xbE", "6It23Wbw5zs", "fHIDIgqEMTo", "WOIcsmjyHD8", "GrfOwa6OmEw", "afmNeknZwMQ", "bDukmXFFIxU", "CvDJcLBgeAo", "ORTWMhoPEcY", "lxhucscYtJA", "FxQfO57QQss", "KG_BDORe32s", "AoNGdGn-OgI", "0yGQSNYWZM4", "5ceEbUcYNwA", "TgLTzXCFOQw", "fn57e3jmJFQ", "f_YhMFnTbAU", "trCTKFR2U6c", "s7aN9HGXgVQ", "CJTnlK-LYyI", "T99LCt8ZNoc", "luAW9YOHEfA", "TTItItLLZws", "xaY-XR78QMY", "srnBDA0MJSk", "cUu5-gx5xI4", "sKtpWcol6ys", "IjYpyAzaj1E", "uq4wKUHJgZo", "vuc5kFIri5g", "y_TOrVGXxeg", "NXVbsJx-UWY", "K1Z7Zi8IC84", "DLOSgr1djoc", "28IegQi6m9w", "Km5CH2yRU98", "F7_ZTZuTeC8", "xmkyRFZnr-8", "6nLK-awvk7w", "Csa0uN_bcPg", "9lY-azV3Pj0", "Xh0upq63L2M", "gJWXVg4MhNE", "nNf_Z0nUqGg", "63MbL-SWE_Y", "PaOfAbVD7D0", "3TTURP2-XWQ", "Cb0cNkF3LAA", "zDXz1uAn3qM", "WZj3J4g2z_Y", "9RG0pUqycBk", "gqtko7Ww838", "MNVN1J93LdY", "rYRLH8EhwGc", "sb7d68pBW2o", "Tt2dnmdD0yo", "yBi9qUYOdPY", "EEZwpWvX4EE", "pupdXW_Xe7g", "YPFx3YE41JY", "9VosMuPq1Cw", "-D4xKx7HH7o", "qx0MUIDJQeI", "FN0IPx1qqwM", "ZxhpqH5Mrmw", "EGq5HxdI2rA", "ciRB43tVKs0", "MvBraabPjWw", "9t1DjIOlBlQ", "FLmqhiJ3vbk", "OtmidDnjbfU", "Wth7GIe6yqs", "mnHcptUzQSw", "D5Ouxbku8jA", "ZZYOypkdy3c", "XubR3yTHgWw", "ZEi4fkZHEBw", "X6crUmzN4uc", "wBpUURdB4tA", "0q334yIkCCQ", "TE4ZzXxS01w", "xQeDyZ0QAgw", "Ah4QzGYCz8E", "KiYqfjKy8Us", "WyuY8fwlxXQ", "q14LYlgYz3g", "oH16ddyw1nI", "CB_10Ucrk30", "iIu5PAS9mQU", "Q4jOnbuXKTk", "z8D1IgZA97k", "1L0ENtUsrvE", "LvzCiLkSyBE", "ccFbMaVO00w", "AXm-xajniNw", "MEkzlYJpxBU", "OfCNeRO8w_I", "ICb1IwLVDdM", "R6LU8KU2rSA", "bA7Q6kCprBY", "gMvIqaPQ1GQ", "JMN-SKP9oN0", "MaSXwDj7ZKI", "tv7m8yTrYSM", "zQWOzMWKc9Q", "7QYUUwgNBWs", "8IsKEZVl1eo", "1nxaeFtiz4w", "N1BuLCNuwRc", "HcsAv2KFcJs", "UfTO-AT2VFM", "QVZVffgeUX4", "wruvgdnF2ws", "M4RnuALYjSE", "ZXN50aUxNKE", "vKTluybsuRs", "8O_FvklrGRU", "rrJVQ0trNv4", "Z0QLI7jkzjo", "nuqdDk5wEvY", "BeK0n9txv3k", "WI2WpADn5hM", "80Ux8RrRcEo", "Vd6iWwuSZA4", "T7QwdLhzflo", "g1BU8BwopIw", "W0595YQTz7k", "B-6RdBmtCe0", "IZPEwq3MysY", "tqp5ociSuxg", "cSeSqYemrlM", "jaHLyGEbQlc", "sbowEmEtHYI", "8UuB2n1DHmE", "WAMcF2YrQNE", "B7u1slaac5E", "AD5ZaM8xKEI", "2mQKfSPu5F0", "eYTV9Vu7nQY", "ET97ursZMVk", "4gCmmQEhfoo", "UVE5OvlpS9A", "M_wzsoAar6w", "0RLasNRsq8s", "3iXHP9bP4AU", "VTQv7jvQ-oo", "evhFOF1xiW8", "3TTYze3RvU8", "SidqUhimC9o", "q8rSX0Vnsag", "7XOJ1s8jNyM", "T_nlxSPNqJQ", "zKgZ4TaXYHo", "bhVCl29VXxY", "Im0FiS5bt5E", "IE9lkcXbebQ", "TmGYuEXzGq8", "wSQooTRcl-4", "JRDGI-uo6Fs", "TtvqJldiPW0", "nzxkxKvThw8", "88eume-S9MA", "cU8t5ibxrmA", "3IuHiCqTkPI", "FN914dZOAt8", "3jMLy7YmrpA", "nNVv2_971B8", "zig5hm1Ztoc", "1iYz7MVHjUI", "NYzve4KvAO8", "rnYpAz0L-cM", "ZvplkokNLA4", "Ka1vY5B0Y7E", "TexCY-OZxLA", "-7pSB3ChR4U", "oxwQzaJ2D14", "JaSxoB-Kv-4", "Xlwcd9WGrbs", "iD7TEeN0bzI", "z04ElhlQEH0", "M6TKOJCgJNw", "N2zopq4-k44", "7a_y81afchA", "3ps6CI1BNwI", "kxTPym383gs", "F3FSBwguqWw", "uj7-GEZORBE", "06WgKvrD-8w", "AI2Di5SyoiU", "48KGm13rXaE", "TSkcRKO8lKo", "1N8rxkvgqv8", "HMHHhBweLHc", "8dDyhlqkl5k", "SDPvSV5_MqE", "9sNY_dZcs1M", "FIsJhf-aw8k", "leIz4gcdLx0", "zVzNuJhEwAA", "Ah9DWg3V5GM", "PHYib5rPhko", "Yj9MZV7mt74", "DwxSXIcDWSc", "NUbTIXpNlXc", "hDZD5-3WA_I", "jxbtLfHWboI", "oohcMcjb24o", "gRTW-337fHA", "uTlMItvFjr0", "bb4X3vz1cQM", "Z9eao4Fa2k4", "tjTIn6wUSd8", "tQZCV0YXico", "WiAO6vXotPo", "fbVENEsY1FI", "gj0pVFlqGfQ", "ShAzNdUgM9U", "uXTLOgoHnQA", "BVGv_R5USbA", "iiPVKEe-jDI", "wyau1wQhRNI", "Zw8mHKtJBEM", "l4BWDElV1So", "lLTK5hAHSPo", "gJyhxeXfix0", "MGQwHU1-o8Q", "ZGlBF61ts-M", "HEL_pW0Ix0k", "ggO8wKKXwHk", "mtH-ztHr064", "P_sY-iB8Fgs", "AoSfA_D62nw", "urIEtCi8lDs", "LPSWehusX1k", "IGjMVN4ull0", "HdbKS5rjE1s", "YAb_bi1YpBk", "avRn4sucMgI", "MIuD5nOr2-I", "w7O_yVMU__A", "_KSnqy-lhVo", "kGsDEmWcxP4", "QLsI2d7AQxc", "IYmLxasR8UA", "vBOSU8km_Eg", "moT0Rnc-Vus", "6GuMuLmy7ho", "R8cvNBdlr5Y", "XCof5wQruP0", "UkN7mqXPgIg", "OteSasPddN4", "3knf6zqNeBM", "_rt0FBa0c9Y", "Gb8-vlWy4ak", "MSsUyJj4pXc", "gwX6hDz1PSw", "sRj2zvy0Qm8", "9TdWPbRfClU", "9yuqsKRuH_0", "Umco5DWX2Gc", "WwPV-1Fu8fc", "2dks8MnrVvk", "xdc8NiG6RQM", "dqpCA9uJ39I", "tMU6QGaffNc", "e4FPvpNcMik", "Kj7IGFPvRu0", "xZa6pivT7nY", "jDoqZMWwNtU", "Pfyna4s_O_0", "JXv-Y0xLQdg", "fbm9hQSDIXM", "uHlZLkXhPUg", "JbvQRqtkmSs", "97hMXs4ogC8", "zTlg6-7be3A", "XV7OvREieT8", "PRKGR9FuVKE", "8-cRrYV9qAc", "a0xsGA3tvTw", "NHCnTYgMPKI", "YsAWtN49o14", "J1Iv5pUfIH4", "rnOgkts4qUU", "i_HwdpS0OPI", "iUVanI1J2Rg", "ZOA5552m7yM", "eQHAIf8qUgc", "VZKbTCw6Lis", "Tuyx7UEoJPU", "xvQUY1PWieo", "KWOGMswhBfo", "cUVUkJcjU88", "d8w5VLwAv8k", "NA3IFKczCqc", "Qm1YLoqskmU", "TFgPRtXYWl4", "3CB72NkzOqI", "xV0s_JUwEs4", "ifeWeZMGf9k", "xiGvhCXkS_E", "YE6gqE79Cl4", "qudOcxlLPlk", "95LWziLTi60", "uaxfvmf2pAI", "n8FgDNWr4i0", "dhSD4SBP7rg", "QrqXZqda08s", "ccb_lnLlJsc", "PzNXoJSOlao", "V4NjTZP7QVY", "mQpYVdBskgw", "lRwHbcmiteY", "8Zm30M1TFCg", "wzEGkYcDhss", "NYfAy6DVIvw", "-PFNO35YWjw", "3LNNo-N-Qms", "jG6xB7KhW0g", "ScvBvMJJpss", "z8TclLcFI4A", "Nro8hwV8ABg", "aQLEbbDsVYA", "-PMwT9_oAas", "fhuLIVb2UsQ", "K83S2CDs9Jg", "LBnPJXmUPPo", "pslKYLhv3m8", "xXsBQtxpwCU", "5CsgmHEXxmg", "6MUjAuyNI7A", "ASm4DPUP5P8", "UEqmhhUtYTw", "LHW3Ae8_u4g", "6KQ9YgQK_Vg", "poS3qz0Uk3M", "GnFZpdVl31s", "vpvuMp7cYHU", "Z637eJuRI7Q", "czsK_HoYZ6M", "SIjFxf9GZN8", "QtGZpjhT3fs", "ufEaIAc_tiM", "40YSZK2W22w", "51HR_bBeZiA", "CSBvywHOmtU", "MGvMTTjt-_8", "rwEPfG9AubQ", "VETefrHyBxU", "y1WHZfkeujE", "GngLDFmUyu8", "oX2jgHTSacw", "cGRavHakLaQ", "GWrrwHue7uo", "rSsUhPyJLh0", "zMEO2vZ7i5Y", "QI4lyJ0FCD0", "Zd0oW0zde7Y", "43Kdb3tncw4", "i3O9c55CAAc", "GgXVb8YTcHE", "J1eOl8t3F80", "flKRBZLPjBo", "D3E3ON7qY2k", "7iI7eScsKhI", "fR9yQUkldKY", "A6wIo2fsJAA", "kp5CtIBnvX0", "sE-QmB1R8sE", "xBkqqSzrrm0", "vfAilkE8IlM", "IH7f0muMSmg", "AdVQqacINqA", "ZPKoNme4AP8", "BEu4ER9EaWM", "0PuoLqiXWeo", "oOrTQ6FmKK0", "YENXn38oqKY", "adub_wnb-nQ", "ck_QsLEZ-js", "WnLLolrYZEI", "O3AfaClfsHE", "RRijTdPXOrU", "qoBtvAZW7d4", "2yX7Fs5LMQI", "pYaY_bUFNw4", "wo0niv5hnvc", "kiNIjZhb0lE", "EBEqLv5l1k8", "7sQzzg2XCZQ", "nX7dnIm7lpA", "jgxQJP22NyQ", "wQyeFkWzx2U", "xutXYtzqGnw", "CZvFKlqUS2s", "LZQ_UOJeLno", "WEs2UvC6nMk", "bTtPU55FLAQ", "5kgzeT9Rsx0", "M4UcQvO5QbQ", "gzDZN7iA34M", "mqHljoxqsCc", "IDhoHrbyYBM", "cC8vQy89KjU", "1dVbPD3zcz0", "e93QXcp3SAo", "Wdh1Z62K-ms", "_fsL80WycNg", "1XzUvI1Wk4Y", "a4pZd8tbBlk", "z5-C2cEHG18", "L_w6yHs4NJY", "V1GY4MateXc", "-AvNTJbE3vo", "VURLOWlyuoY", "0xQia0HDN10", "Rpctqr6o8XA", "Zjafw_wwfYU", "-RWHDXak_4M", "JCLAso3CfC8", "YNOqeDU_zPQ", "SIq2kii2v6I", "lu5MDw5D8iA", "7ubguKRJLJk", "cbX25NXcO1s", "Zhbz2Z2O0dc", "BD6fjEHQXbE", "c4NECpbhFHg", "fIT-g5W0QLc", "US2nGl5LE6I", "NbZ08SsO0bY", "7mOHezQba9c", "etKD7xVy3dw", "i7BTDWorvKk", "CAEKSeZz_e0", "LY_TOOUyRpo", "6vkNDAj_Gao", "XrlNtJyYWWc", "YWmlv0jwKOU", "Cp4s3BZo6vs", "WTYHn2pNu9c", "o2ip07m-pN4", "S6lB9rmTQRk", "-RQ6S-aIKXQ", "McL2jjR5RpI", "H-WV_EVfMRw", "D-Nwyzgdda4", "yYpk_18vn10", "SHYTRZJSEJ4", "41dWGB3kj1o", "qgTENVyM4f8", "bFbcgMvVM9o", "zXEsQKfsEiQ", "_PXoeZEIp6Q", "xudF6KuGAWs", "sKULNGuRNxY", "GnJbEJEQ3LU", "kMC1FPgZ3zA", "Sb7VlihgWAM", "aPeWJs6k8Zs", "LmEaEee6VGo", "olcAikUsqkY", "8bIYGudyPLw", "43YnE7B_khs", "26gZGWd1P_o", "rfNjhVoPj9Y", "CwxKKgf32Vs", "f6k1y-pmaDI", "yIWzyFC9Omk", "a-cZVtVMujU", "JPJb7Mo28A0", "ssXtMOOwZ3c", "TKKitEtyRuE", "x9VgjO5Swp0", "0hp9qX54vg8", "eHexRhTxBbM", "rHY_6En8lqQ", "mbdkkvas_Ik", "Oo0JPa5p90w", "NoIQ9EBH3cg", "Da1WvumcJaE", "ZXyLo1Jgduo", "vRSiiYbZ5Hk", "ZpyxMLpwFFE", "K5Q301YU73I", "T7n7xfigsHQ", "Xk82ooGeJUk", "ghgFC_iMO0U", "utMrAGr2ijg", "5KJPospyGmA", "yu4nYNbxMc0", "oLKvJn7RaNc", "3mZg9qqWpmw", "-9rK2uCB_Sk", "vuJ7hbQcW2A", "Xa-cwHCp9ts", "BiLlpzM2QTQ", "QgMRjhX9p0U", "0y89DorvCLA", "qXbG3vdWNnU", "UjbtV6jVif4", "XPUPjxgj0lk", "icjCH29R2Bg", "uXoLyaCXInM", "HdwEPtmuVk4", "bcj7BWpbFf4", "w5R-9QAseUA", "DsxmkjpszjI", "8NFtmiWP4rA", "Nz0F34STTs8", "lPs81HRtiU8", "A1Va0FZoA1c", "FgcaqaUI1bk", "5mXSbP35ztI", "v4UY12FHtyU", "l2Ue-iqn5jU", "kGfESOpuZgc", "OK1AYtrTdtU", "1930AEGhxDI", "oxYrOPD9wdA", "B6cidAPT78o", "HtbeF-2iG4c", "-Cv3Rcm-ZL0", "YoLedymdDMo", "GMcWcJ3iTtY", "G_AprAUyY9c", "GY0hFKxYY0I", "XHvsAVo3TAw", "ZzSkAgBxjY4", "l_4hDhRm9cI", "Pvzp8DNcXJo", "c8ZdrLHjYxU", "bLX4MvSX9Yo", "AD1hwbHb0Ms", "WluKmfmmbhw", "JTsIkxPPaZs", "xVUlJHrwWPw", "UF-UDrjJ6zg", "BiH8fwFkLTg", "XBMLMji7NEM", "j8zh8EYSdvw", "uLgRnbcAMK8", "BX9Wn0jDn1U", "W2LMzMFN9ek", "-qldD4wY99A", "qxdPSAydVHk", "CSBdSpkzm-Y", "TWJO1E6FLDM", "KM3HE9Fc3Q0", "g1jJsAGwyjg", "qR9cDyUWhC0", "I0XrNxdSytU", "yzm10Ce-c2o", "AA2kmKQV6bA", "-JqRz8WbTio", "FSe4RO4O6T4", "sY_fTBr-Gp4", "nDVYd54ojSU", "Jj9sf8ZtF9Y", "W7m9XXL9GO8", "JJYr9iiz3Gs", "myuJ0mstg9Y", "9Ts9s2yB58o", "2gWDaozoWDY", "G6VmqDUpugA", "VGS-ODoAhIA", "I59M6axwRUI", "D3cqume7WJM", "zSFaat7rPWg", "EGJpqgbKXkg", "ONcEIojtTaw", "RynToEoYBSs", "gf-lH6cJUoQ", "zTvtyst1QkA", "YrC_7hip-9Y", "Ui1nDa_bCy4", "hYjPY6Z35Ro", "h-POYUHgKB0", "oWr23PdofXM", "upLWIwtc3FU", "21RpTcBY384", "8ghgoyAK6nE", "0LyMak_V06w", "zmD4TwYUy_4", "Pzge7xLi8vE", "cn8wKSIblGw", "yK6qmTo7NoE", "Zw-STWl-PSY", "MN-f100bfzc", "xVJR6JNrXUc", "Vdsnyu4Qz3g", "VruHK4hWlNU", "ZZu_nKYRVm8", "BAzRQ9ecMZ0", "WnuqxrYE6mc", "iZ_3shRG2eo", "2Gurpu0VCqE", "r0KjnB_pyRI", "TRrm7JUGcdU", "kY8yq9nLPVY", "q5k9V7Kfexw", "FgTAMapGZfo", "337K2i4gGVQ", "sbP3p-bGTOg", "_tqhqa2am7g", "nJ_ZwOWHJdE", "sHagkqqZfMs", "sHFviWwFMoI", "0G1CmYjTMvo", "9yqzXRzTAuw", "jWPcxxv_18U", "O-6xXcUJIt0", "p3e3HpMlb5k", "8MtzljO2E7A", "xbq_NMuuocI", "8zSWxtqpHcU", "WhgHr3AviCQ", "6wIvq2OWAwU", "-coCNdJtT-Y", "3Pg0qudvBhE", "et3dNM7Vh9Y", "FQukRQ1wvak", "j44nCchU_WE", "6y4j8p9nFfQ", "fJr6ABQOJJ4", "UgeSvz56Ots", "BILBqz-l7NU", "glmGjZQri6k", "KB1pqHVneAs", "UbcFJshEGmc", "R-cL5hIsvk8", "3fvhyQieubI", "3dVPBYo1jAk", "AJvp97EJAw4", "pMHIWMjNigo", "w2ocbQujM8k", "RJkt0b9a6Sg", "Y6K1101B-hg", "fMHUiAjXS8Y", "TgVwFZTEwnc", "u9EVXE3Y7ns", "_a163JDzrdc", "J_4lOREqVY4", "Fr0zVWum4O0", "ySFcHcupqXI", "abIJCM5ZhBw", "thrMzHNPkQM", "G5lQwFbGZaw", "oNogDeA4WSc", "ALXvSeZ2wE8", "ZSocD6cLniM", "9aXW2V1r6FU", "r4cAQKV1-Pk", "mo3du7OtFnc", "6G0UJUUtVAk", "YqjJR4Ifxkc", "s54dgfR6xI0", "kXhJQfrYcu8", "JKiy7RaBpVc", "O1neb5vYvnM", "aWopeAqt28w", "A5_T7P_HVgY", "umc04AdDlww", "6U4zcIti5Gg", "nGC-ZRqWpaY", "TaSLcAbAQZo", "QImpnBSb-xY", "PtOxfppAgRk", "9ocsCdQ2eQs", "q7RkDa8tPQg", "xS7t4V487cw", "F5t_rlwtm-c", "Ify9w9xJJyk", "ero4kvBlv9Y", "_Taeb9VCl5E", "jPAKNXcihpc", "Qjedo7-6_xw", "ksLd4XRZHLI", "lundloDYu9k", "vgbAamoEN9w", "DjQMRaYIRbQ", "9S3QO3Emdnk", "ydvhwPfrmPU", "mxl9OxYhdgw", "SvGFiB2AR1Y", "YSFMIt2hE10", "my8NZhZJPy8", "pTBZ69AFhUY", "B2oTcGMUMZE", "yhnXGwGQv8Q", "pzcjyPLFb9E", "QVIDO8WREsc", "_j8jsxCY-Co", "bwG2gU3MR4w", "YMZRhbfTBtQ", "eRi0l-6pX9c", "2KB4MVutOHg", "D0cEaueB1Kg", "S_DtE5T2U84", "w6oyinl_xak", "mCrf4OR1K3k", "NO4kf0nLKUk", "38dPH9MI4nY", "CHXRhdcix-E", "_C3TH74qxtA", "kl91nXPVZg0", "2oWe4iHRBQY", "-6-O1JmUBDw", "r_mmqRWFRFc", "AJlGhQRSpEA", "Jo59l-b6o8o", "9Wr9v8L3K7w", "agEztNXyXws", "_xXJirOdcWI", "JA0rdWDYLjY", "16XCuSKiFIY", "yhvSoc-avI8", "tYo9ZmMqk50", "M9RFGK5gepw", "V7hlqBas8nA", "mH0s0lEDNnE", "afSgb4eezHs", "vVKKLGBLS0M", "ZLjc2_fi51Y"];
    }
  });

  // src/content/handlers/external.ts
  var ExternalHandler;
  var init_external = __esm({
    "src/content/handlers/external.ts"() {
      "use strict";
      init_youtube_ids();
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
          if (rule.text.toLowerCase().includes("chess")) {
            return this.solveChess(rule);
          }
          return this.fallbackToHuman(rule, "External rule requiring manual input:");
        }
        async solveCountry(rule) {
          const country = await this.waitForCountry(3e3);
          if (country) {
            console.log(`[PWG] \u{1F5FA}\uFE0F Auto-solved GeoGuessr: ${country}`);
            return { zone: "country", content: country, priority: 85 };
          }
          console.warn("[PWG] GeoGuessr country not available automatically, asking user.");
          return this.fallbackToHuman(rule, "GeoGuessr: What country is shown on the map?");
        }
        async waitForCountry(timeoutMs) {
          const start = Date.now();
          while (Date.now() - start < timeoutMs) {
            const country = window.__pwgCountryAnswer;
            if (country && typeof country === "string" && country.length > 2 && !/[\\^$.*+?()[\]{}|]/.test(country)) {
              return country;
            }
            await new Promise((r) => setTimeout(r, 200));
          }
          return null;
        }
        async solveChess(rule) {
          const move = await this.waitForChessMove(5e3);
          if (move) {
            console.log(`[PWG] \u265F\uFE0F Auto-solved chess: ${move}`);
            return { zone: "chess", content: move, priority: 86 };
          }
          console.warn("[PWG] Chess move not available automatically, asking user.");
          return this.fallbackToHuman(rule, "Chess: What is the best move in algebraic notation?");
        }
        async waitForChessMove(timeoutMs) {
          const start = Date.now();
          while (Date.now() - start < timeoutMs) {
            const move = window.__pwgChessAnswer;
            if (move && typeof move === "string" && move.length >= 2) {
              return move;
            }
            await new Promise((r) => setTimeout(r, 200));
          }
          return null;
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
          let totalSeconds = 0;
          const minMatch = rule.text.match(/(\d+)\s*minute/i);
          if (minMatch) {
            totalSeconds += parseInt(minMatch[1], 10) * 60;
          }
          const secMatch = rule.text.match(/(\d+)\s*second/i);
          if (secMatch) {
            totalSeconds += parseInt(secMatch[1], 10);
          }
          if (totalSeconds > 0 && youtubeIds[totalSeconds]) {
            const url = "https://www.youtube.com/watch?v=" + youtubeIds[totalSeconds];
            return {
              zone: "youtube",
              content: ` <a href="${url}">${url.toLowerCase()}</a> `,
              priority: 80
            };
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
      var KNOWN_COUNTRIES = /* @__PURE__ */ new Set([
        "afghanistan",
        "albania",
        "algeria",
        "andorra",
        "angola",
        "antigua",
        "argentina",
        "armenia",
        "australia",
        "austria",
        "azerbaijan",
        "bahamas",
        "bahrain",
        "bangladesh",
        "barbados",
        "belarus",
        "belgium",
        "belize",
        "benin",
        "bhutan",
        "bolivia",
        "bosnia",
        "botswana",
        "brazil",
        "brunei",
        "bulgaria",
        "burkina",
        "burundi",
        "cambodia",
        "cameroon",
        "canada",
        "capeverde",
        "chad",
        "chile",
        "china",
        "colombia",
        "comoros",
        "congo",
        "costarica",
        "croatia",
        "cuba",
        "cyprus",
        "czechrepublic",
        "denmark",
        "djibouti",
        "dominica",
        "dominicanrepublic",
        "easttimor",
        "ecuador",
        "egypt",
        "elsalvador",
        "equatorialguinea",
        "eritrea",
        "estonia",
        "ethiopia",
        "fiji",
        "finland",
        "france",
        "gabon",
        "gambia",
        "georgia",
        "germany",
        "ghana",
        "greece",
        "grenada",
        "guatemala",
        "guinea",
        "guinea-bissau",
        "guyana",
        "haiti",
        "honduras",
        "hungary",
        "iceland",
        "india",
        "indonesia",
        "iran",
        "iraq",
        "ireland",
        "israel",
        "italy",
        "ivorycoast",
        "jamaica",
        "japan",
        "jordan",
        "kazakhstan",
        "kenya",
        "kiribati",
        "koreanorth",
        "koreasouth",
        "kosovo",
        "kuwait",
        "kyrgyzstan",
        "laos",
        "latvia",
        "lebanon",
        "lesotho",
        "liberia",
        "libya",
        "liechtenstein",
        "lithuania",
        "luxembourg",
        "macedonia",
        "madagascar",
        "malawi",
        "malaysia",
        "maldives",
        "mali",
        "malta",
        "marshallislands",
        "mauritania",
        "mauritius",
        "mexico",
        "micronesia",
        "moldova",
        "monaco",
        "mongolia",
        "montenegro",
        "morocco",
        "mozambique",
        "myanmar",
        "namibia",
        "nauru",
        "nepal",
        "netherlands",
        "newzealand",
        "nicaragua",
        "niger",
        "nigeria",
        "norway",
        "oman",
        "pakistan",
        "palau",
        "panama",
        "papuanewguinea",
        "paraguay",
        "peru",
        "philippines",
        "poland",
        "portugal",
        "qatar",
        "romania",
        "russia",
        "rwanda",
        "stlucia",
        "samoa",
        "sanmarino",
        "saudiarabia",
        "senegal",
        "serbia",
        "seychelles",
        "sierraleone",
        "singapore",
        "slovakia",
        "slovenia",
        "solomonislands",
        "somalia",
        "southafrica",
        "southsudan",
        "spain",
        "srilanka",
        "sudan",
        "suriname",
        "swaziland",
        "sweden",
        "switzerland",
        "syria",
        "taiwan",
        "tajikistan",
        "tanzania",
        "thailand",
        "togo",
        "tonga",
        "trinidad&tobago",
        "tunisia",
        "turkey",
        "turkmenistan",
        "tuvalu",
        "uganda",
        "ukraine",
        "unitedarabemirates",
        "unitedkingdom",
        "america",
        "uruguay",
        "uzbekistan",
        "vanuatu",
        "vaticancity",
        "venezuela",
        "vietnam",
        "yemen",
        "zambia",
        "zimbabwe",
        "england",
        "unitedstates",
        "britain"
      ]);
      var countryBatchSeen = false;
      window.addEventListener("message", (event) => {
        if (event.source !== window || !event.data) return;
        if (event.data.type === "PWG_GEO_HACK") {
          window.__pwgCountryAnswer = event.data.country;
          console.log("[PWG] \u{1F5FA}\uFE0F GeoGuessr intercepted via API! Country:", event.data.country);
        }
        if (event.data.type === "PWG_SPY_INCLUDES") {
          const candidate = event.data.str;
          const CHESS_REGEX = /^[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?$/;
          const CASTLING_REGEX = /^O-O(?:-O)?[+#]?$/;
          if (!window.__pwgChessAnswer && (CHESS_REGEX.test(candidate) || CASTLING_REGEX.test(candidate))) {
            if (!KNOWN_COUNTRIES.has(candidate.toLowerCase())) {
              window.__pwgChessAnswer = candidate;
              console.log("[PWG] \u265F\uFE0F Chess move detected from spy:", candidate);
            }
          }
          if (KNOWN_COUNTRIES.has(candidate)) {
            if (!countryBatchSeen) {
              countryBatchSeen = true;
              window.__pwgCountryAnswer = candidate;
              console.log("[PWG] \u{1F5FA}\uFE0F Country detected from spy (first match):", candidate);
              setTimeout(() => {
                countryBatchSeen = false;
              }, 3e3);
            }
          }
        }
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
