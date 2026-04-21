import { ClassifiedRule, Handler, ZoneUpdate } from "../../shared/types";
import { PasswordEngine } from "../password-engine";
import { BudgetTracker } from "../solver/budget";

export class TimeHandler implements Handler {
  async solve(rule: ClassifiedRule, engine: PasswordEngine, budgetTracker: BudgetTracker): Promise<ZoneUpdate> {
    const now = new Date();
    const formatted = `${now.getHours()}:${now.getMinutes().toString().padStart(2, "0")}`;
    
    return {
      zone: "time",
      content: formatted,
      priority: 45
    };
  }
}
