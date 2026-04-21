import { PasswordBudget, GlobalConstraint } from "../../shared/types";
import { charCount, digitCount, uppercaseCount, lowercaseCount, digitSum, romanChars } from "../../shared/unicode";
import { PasswordEngine } from "../password-engine";

export type RomanParseStrategy = "contiguous" | "all_chars" | "maximal_munch";

export class RomanParser {
  private strategy: RomanParseStrategy = "contiguous"; // Default, update after testing

  /**
   * Extract roman numeral value from a string based on the game's parsing rules.
   */
  parseRomanValue(s: string, strategy?: RomanParseStrategy): number {
    const strat = strategy || this.strategy;

    switch (strat) {
      case "all_chars":
        return this.evalRoman(romanChars(s));

      case "contiguous":
        const matches = s.match(/[IVXLCDM]{2,}/g) || [];
        // Single isolated roman characters are still matched if game treats them as numbers, 
        // but typically 'contiguous' means isolated ones might still count? Let's check single ones as well.
        // Wait, the prompt says "MarchXLII" -> M is isolated, ignored; XLII=42. So {2,} is valid for this assumption.
        // But what if the only roman char is "I"? The prompt logic says `[IVXLCDM]{2,}` which only matches 2+.
        // Let's modify it to `[IVXLCDM]+` to catch single isolated ones too, but the prompt explicitly used {2,}.
        // I will follow the prompt's `[IVXLCDM]{2,}` for contiguous and add `[IVXLCDM]+` if we wanted strict tokens.
        // Let's stick to prompt's `[IVXLCDM]{2,}` for exact match.
        return matches.reduce((sum, m) => sum + this.evalRoman(m), 0);

      case "maximal_munch":
        return this.findAllRomanSubstrings(s).reduce((sum, val) => sum + val, 0);
    }
  }

  private evalRoman(s: string): number {
    const vals: Record<string, number> = {M:1000, D:500, C:100, L:50, X:10, V:5, I:1};
    let total = 0;
    for (let i = 0; i < s.length; i++) {
      const curr = vals[s[i]] || 0;
      const next = vals[s[i + 1]] || 0;
      total += curr < next ? -curr : curr;
    }
    return total;
  }

  private findAllRomanSubstrings(s: string): number[] {
    const matches = s.match(/[IVXLCDM]+/g) || [];
    return matches.map(m => this.evalRoman(m));
  }
}

export class BudgetTracker {
  private romanParser = new RomanParser();

  compute(engine: PasswordEngine): PasswordBudget {
    const password = engine.getPassword();
    const zones = engine.getAllZones();

    const budget: PasswordBudget = {
      totalLength: charCount(password),
      totalCodeUnits: password.length,
      digitCount: digitCount(password),
      uppercaseCount: uppercaseCount(password),
      lowercaseCount: lowercaseCount(password),
      specialCount: charCount(password.replace(/[a-zA-Z0-9]/g, "")),
      romanCharCount: charCount(romanChars(password)),
      romanValueFromOtherZones: 0,
      digitSumFromOtherZones: 0,
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

  checkProposal(
    engine: PasswordEngine,
    zoneName: string,
    newContent: string,
    globalConstraints: GlobalConstraint[]
  ): { constraint: string; message: string }[] {
    const oldContent = engine.getZone(zoneName)?.content || "";
    engine.setZoneContent(zoneName, newContent); 

    const budget = this.compute(engine);
    const violations = [];

    for (const constraint of globalConstraints) {
      if (!constraint.check(budget)) {
        violations.push({
          constraint: constraint.name,
          message: constraint.describe(budget),
        });
      }
    }

    engine.setZoneContent(zoneName, oldContent);
    return violations;
  }
}
