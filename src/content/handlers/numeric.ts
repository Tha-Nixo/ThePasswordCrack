import { ClassifiedRule, Handler, ZoneUpdate, PasswordBudget, NumericConstraint } from "../../shared/types";
import { PasswordEngine } from "../password-engine";
import { BudgetTracker } from "../solver/budget";
import { digitCount, uppercaseCount } from "../../shared/unicode";

export class NumericSolver {

  solveAll(
    constraints: NumericConstraint[],
    engine: PasswordEngine,
    budget: PasswordBudget
  ): { digits?: string; roman?: string; elements?: string } | null {

    const digitSumConstraint = constraints.find(c => c.type === "sum" && c.target !== undefined);
    // Not explicitly distinguishing roman target from others yet but assuming it's structured somewhere else if needed.
    // For simplicity, let's treat "target" as digits target since the prompt showed: const adjustedDigitTarget = (digitSumConstraint?.target ?? 0) ...
    // Let's implement digit logic.
    
    // In a real expanded version, these would be separate constraints passed.
    // We simulate the prompt's logic:
    
    const adjustedDigitTarget = (digitSumConstraint?.target ?? 0) - budget.digitSumFromOtherZones;
    const digitCandidates = this.generateDigitString(adjustedDigitTarget);

    // Check for Roman Numeral multiplication
    const romanMultiplyConstraint = constraints.find(c => c.type === "roman_multiply" && c.target !== undefined);
    
    // Check if we need Roman Numeral presence
    const needsRoman = constraints.some(c => c.type === "roman_presence");
    let romanString = "";
    
    if (romanMultiplyConstraint) {
      // Assuming other zones have no uppercase Roman numerals, or their product is 1.
      // If we implement a Roman multiplication tracker, we would divide target by current product.
      // For now, we supply the literal target value which will be parsed as a single Roman numeral.
      romanString = this.intToRoman(Math.max(0, romanMultiplyConstraint.target as number));
    } else if (needsRoman) {
      if (budget.romanValueFromOtherZones === 0) {
        romanString = "V"; // Just supply a basic Roman numeral
      }
    }

    // Checking global budget logic
    const totalNewLength = budget.totalLength
      - (engine.getZone("digits")?.content.length || 0)
      - (engine.getZone("roman")?.content.length || 0)
      + digitCandidates.length
      + romanString.length;

    const newDigitCount = budget.digitCount
      - digitCount(engine.getZone("digits")?.content || "")
      + digitCount(digitCandidates);

    const digitPercentConstraint = constraints.find(c => c.type === "ratio");
    if (digitPercentConstraint && digitPercentConstraint.maxRatio && (newDigitCount / totalNewLength) > digitPercentConstraint.maxRatio) {
      // Need length constraint handling, simplified here
      return this.solveWithLengthConstraint(constraints, budget, engine);
    }

    return {
      digits: digitCandidates,
      roman: romanString,
      elements: "", // Placeholder
    };
  }

  private solveWithLengthConstraint(constraints: NumericConstraint[], budget: PasswordBudget, engine: PasswordEngine) {
    return { digits: "0", roman: "", elements: "" }; // Fallback
  }

  private generateDigitString(target: number): string {
    if (target <= 0) return "";
    const nines = Math.floor(target / 9);
    const remainder = target % 9;
    const digits: number[] = [];
    if (remainder > 0) digits.push(remainder);
    for (let i = 0; i < nines; i++) digits.push(9);
    return digits.join("");
  }

  private intToRoman(num: number): string {
    if (num <= 0) return "";
    const vals = [1000,900,500,400,100,90,50,40,10,9,5,4,1];
    const syms = ["M","CM","D","CD","C","XC","L","XL","X","IX","V","IV","I"];
    let result = "";
    for (let i = 0; i < vals.length; i++) {
      while (num >= vals[i]) { result += syms[i]; num -= vals[i]; }
    }
    return result;
  }
}

export function parseNumericConstraint(rule: ClassifiedRule): NumericConstraint {
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

  // Element atomic number sum
  if (/atomic/i.test(t) && /add\s+up/i.test(t)) {
    const match = t.match(/add\s+up\s+to\s*(\d+)/i);
    return { type: "sum", target: match ? parseInt(match[1]) : 0 };
  }

  return { type: "ratio", maxRatio: 0.3 };
}

export class NumericHandler implements Handler {
  constructor(private solver: NumericSolver) {}

  async solve(rule: ClassifiedRule, engine: PasswordEngine, budgetTracker: BudgetTracker): Promise<ZoneUpdate> {
    const budget = budgetTracker.compute(engine);
    const solution = this.solver.solveAll([parseNumericConstraint(rule)], engine, budget);
    
    return {
      zone: "digits",
      content: solution?.digits || "",
      priority: 40
    };
  }
}
