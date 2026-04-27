import { ClassifiedRule } from "../../shared/types";

export class DOMReader {
  /**
   * Reads all rules from the game DOM
   */
  readRules(): ClassifiedRule[] {
    const ruleElements = document.querySelectorAll(".rule");
    const rules: ClassifiedRule[] = [];
    
    for (const el of ruleElements) {
      const topEl = el.querySelector(".rule-top");
      const descEl = el.querySelector(".rule-desc");
      
      const headerText = topEl?.textContent || "";
      const descText = descEl?.textContent || "";
      let extraText = "";

      if (headerText.includes("Rule 28")) {
        const spyColor = (window as any).__pwgColorAnswer;
        const colorBox = el.querySelector(".rand-color") as HTMLElement;
        
        if (spyColor) {
          extraText = ` ${spyColor}`;
        } else if (colorBox) {
          const bg = window.getComputedStyle(colorBox).backgroundColor;
          const match = bg.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
          if (match) {
            const r = parseInt(match[1]);
            const g = parseInt(match[2]);
            const b = parseInt(match[3]);
            extraText = ` #${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
          }
        } else {
          // generic fallback
          const children = el.querySelectorAll(".rule-desc *");
          for (let i = 0; i < children.length; i++) {
            const htmlChild = children[i] as HTMLElement;
            const bg = window.getComputedStyle(htmlChild).backgroundColor;
            if (bg && bg.includes("rgb") && !bg.includes("rgba") && htmlChild.className !== "rule-icon") {
              const match = bg.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
              if (match) {
                const r = parseInt(match[1]);
                const g = parseInt(match[2]);
                const b = parseInt(match[3]);
                extraText = ` #${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
                break;
              }
            }
          }
        }
      }

      const fullText = `${headerText} ${descText}${extraText}`.trim();
      
      const ruleNumberMatch = headerText.match(/Rule\s*(\d+)/i);
      const ruleNumber = ruleNumberMatch ? parseInt(ruleNumberMatch[1], 10) : this.hashCode(fullText);

      rules.push({
        number: ruleNumber,
        text: (descText + extraText).trim(), // Pass only the description to solvers to avoid Rule N number collision
        satisfied: this.isRuleSatisfied(el),
        category: "unknown"
      });
    }
    
    return rules;
  }

  private hashCode(s: string): number {
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
        const char = s.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
  checkWin(): boolean {
    // INSPECT_LIVE_PAGE
    return document.querySelector(".win-screen") !== null || document.body.textContent?.includes("You won") || false;
  }

  private isRuleSatisfied(el: Element): boolean {
    const isError = el.classList.contains("rule-error");
    const icon = el.querySelector(".rule-icon") as HTMLImageElement;
    const isCheckmark = icon?.src?.includes("checkmark.svg");
    
    return !isError && isCheckmark;
  }
}
