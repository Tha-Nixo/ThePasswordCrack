"use strict";
(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };

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

  // src/popup/popup.ts
  var require_popup = __commonJS({
    "src/popup/popup.ts"() {
      init_unicode();
      var logsDiv = document.getElementById("logs");
      var humanSection = document.getElementById("human-input-section");
      var humanPrompt = document.getElementById("human-prompt");
      var humanInput = document.getElementById("human-input");
      var humanPreview = document.getElementById("human-preview");
      var humanSubmit = document.getElementById("human-submit");
      var currentRuleNumber = null;
      var currentBudgetMock = { totalLength: 0, digitCount: 0 };
      chrome.runtime.onMessage.addListener((msg) => {
        if (msg.type === "LOG") {
          const el = document.createElement("div");
          el.textContent = `[${msg.level.toUpperCase()}] ${msg.msg}`;
          if (msg.level === "error") el.style.color = "red";
          if (msg.level === "warn") el.style.color = "orange";
          logsDiv.appendChild(el);
          logsDiv.scrollTop = logsDiv.scrollHeight;
        } else if (msg.type === "HUMAN_INPUT_REQUEST") {
          humanSection.classList.remove("hidden");
          humanPrompt.textContent = msg.prompt;
          humanInput.value = "";
          humanPreview.innerHTML = "";
          humanSubmit.textContent = "Submit";
          currentRuleNumber = msg.ruleNumber;
          humanInput.focus();
        }
      });
      function evalRomanValue(s) {
        const vals = { M: 1e3, D: 500, C: 100, L: 50, X: 10, V: 5, I: 1 };
        let total = 0;
        for (let i = 0; i < s.length; i++) {
          const curr = vals[s[i]] || 0;
          const next = vals[s[i + 1]] || 0;
          total += curr < next ? -curr : curr;
        }
        return total;
      }
      humanInput.addEventListener("input", () => {
        const val = humanInput.value;
        const inputLen = charCount(val);
        const inputDSum = digitSum(val);
        const inputRomanVal = evalRomanValue(romanChars(val));
        const newDigitRatio = (currentBudgetMock.digitCount + digitCount(val)) / (currentBudgetMock.totalLength + inputLen || 1);
        const warnings = [];
        if (inputLen > 20) {
          warnings.push(`\u26A0\uFE0F Long text (${inputLen} chars) \u2014 might break length rules`);
        }
        if (inputDSum > 15) {
          warnings.push(`\u26A0\uFE0F Many digits (sum=${inputDSum}) \u2014 might break digit sum`);
        }
        if (inputRomanVal > 50) {
          warnings.push(`\u26A0\uFE0F Roman characters (value=${inputRomanVal}) \u2014 might break roman sum`);
        }
        if (newDigitRatio > 0.25) {
          warnings.push(`\u26A0\uFE0F High digit ratio (${(newDigitRatio * 100).toFixed(0)}%) \u2014 might exceed limits`);
        }
        humanPreview.innerHTML = warnings.join("<br>");
        if (warnings.length > 0) {
          humanSubmit.textContent = "Submit anyway (may break rules)";
        } else {
          humanSubmit.textContent = "Submit";
        }
      });
      humanSubmit.addEventListener("click", () => {
        if (currentRuleNumber !== null) {
          chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            if (tabs[0] && tabs[0].id) {
              chrome.tabs.sendMessage(tabs[0].id, {
                type: "HUMAN_INPUT_RESPONSE",
                ruleNumber: currentRuleNumber,
                input: humanInput.value
              });
            }
          });
          humanSection.classList.add("hidden");
          currentRuleNumber = null;
        }
      });
    }
  });
  require_popup();
})();
//# sourceMappingURL=popup.js.map
