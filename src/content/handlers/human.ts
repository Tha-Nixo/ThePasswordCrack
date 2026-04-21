import { ClassifiedRule, Handler, ZoneUpdate } from "../../shared/types";
import { PasswordEngine } from "../password-engine";
import { BudgetTracker } from "../solver/budget";

export class HumanHandler implements Handler {
  /**
   * Send a message to the background script / popup to request human input.
   */
  async requestInput(rule: ClassifiedRule, promptText: string): Promise<string> {
    return new Promise((resolve) => {
      // Check if already injected
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
        <h3 style="margin-top:0;font-size:16px;">🤖 PWG Solver Needs You!</h3>
        <p style="font-size:14px;margin-bottom:10px;">${promptText}</p>
        <input type="text" id="pwg-input-field-${rule.number}" style="width:100%;padding:8px;box-sizing:border-box;border-radius:4px;border:none;margin-bottom:10px;font-size:16px;color:black;" placeholder="Type here..." />
        <button id="pwg-submit-btn-${rule.number}" style="width:100%;padding:10px;background:#222;color:white;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">Submit</button>
      `;

      document.body.appendChild(overlay);

      const inputEl = document.getElementById(`pwg-input-field-${rule.number}`) as HTMLInputElement;
      const btnEl = document.getElementById(`pwg-submit-btn-${rule.number}`) as HTMLButtonElement;

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

  async solve(rule: ClassifiedRule, engine: PasswordEngine, budgetTracker: BudgetTracker): Promise<ZoneUpdate> {
    const prompt = `Human input required for rule #${rule.number}: ${rule.text}`;
    const input = await this.requestInput(rule, prompt);
    
    return {
      zone: `human_${rule.number}`,
      content: input,
      priority: 90 + rule.number
    };
  }
}
