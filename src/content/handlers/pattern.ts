import { ClassifiedRule, Handler, ZoneUpdate, PasswordBudget } from "../../shared/types";
import { PasswordEngine } from "../password-engine";
import { BudgetTracker } from "../solver/budget";

const MONTHS_BY_ROMAN_POLLUTION: Record<string, number> = {
  "January":   1, // I=1
  "February":  0,
  "March":  1000, // M
  "April":     1, // I=1 
  "May":       0,
  "June":      0,
  "July":      0,
  "August":    0,
  "September": 0,
  "October":   0,
  "November":  0,
  "December": 600, // D=500, C=100
};

export function pickMonth(budget: PasswordBudget, romanTarget: number | null): string {
  if (romanTarget === null) {
    return "May";
  }

  const sorted = Object.entries(MONTHS_BY_ROMAN_POLLUTION)
    .sort((a, b) => a[1] - b[1]);
  return sorted[0][0]; 
}

export class PatternHandler implements Handler {
  async solve(rule: ClassifiedRule, engine: PasswordEngine, budgetTracker: BudgetTracker): Promise<ZoneUpdate> {
    const budget = budgetTracker.compute(engine);
    
    if (rule.text.includes("month")) {
      // Mock passing a romanTarget
      const month = pickMonth(budget, 35); // 35 is a mock target
      return {
        zone: "month",
        content: month,
        priority: 30
      };
    }
    
    return { zone: "pattern", content: "pattern", priority: 31 };
  }
}
