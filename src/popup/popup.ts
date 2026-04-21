import { charCount, digitCount, digitSum, romanChars } from "../shared/unicode";

const logsDiv = document.getElementById("logs") as HTMLDivElement;
const humanSection = document.getElementById("human-input-section") as HTMLDivElement;
const humanPrompt = document.getElementById("human-prompt") as HTMLHeadingElement;
const humanInput = document.getElementById("human-input") as HTMLInputElement;
const humanPreview = document.getElementById("human-preview") as HTMLDivElement;
const humanSubmit = document.getElementById("human-submit") as HTMLButtonElement;

let currentRuleNumber: number | null = null;
let currentBudgetMock = { totalLength: 0, digitCount: 0 }; // Should be updated via messages in a full implementation

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

function evalRomanValue(s: string): number {
  const vals: Record<string, number> = {M:1000, D:500, C:100, L:50, X:10, V:5, I:1};
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

  const warnings: string[] = [];

  if (inputLen > 20) {
    warnings.push(`⚠️ Long text (${inputLen} chars) — might break length rules`);
  }
  if (inputDSum > 15) {
    warnings.push(`⚠️ Many digits (sum=${inputDSum}) — might break digit sum`);
  }
  if (inputRomanVal > 50) {
    warnings.push(`⚠️ Roman characters (value=${inputRomanVal}) — might break roman sum`);
  }
  if (newDigitRatio > 0.25) {
    warnings.push(`⚠️ High digit ratio (${(newDigitRatio * 100).toFixed(0)}%) — might exceed limits`);
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
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
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
