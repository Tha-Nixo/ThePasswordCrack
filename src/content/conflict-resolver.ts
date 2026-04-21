import { ClassifiedRule, GlobalConstraint } from "../../shared/types";
import { PasswordEngine } from "../password-engine";
import { BudgetTracker } from "./solver/budget";
import { NumericSolver, parseNumericConstraint } from "./handlers/numeric";
import { Handler } from "../../shared/types";

export class ConflictResolver {
  private maxAttempts = 8;
  private numericSolver: NumericSolver;
  private handlers: Map<string, Handler>;

  constructor(numericSolver: NumericSolver, handlers: Map<string, Handler>) {
    this.numericSolver = numericSolver;
    this.handlers = handlers;
  }

  async resolve(
    broken: ClassifiedRule[],
    allRules: Map<number, ClassifiedRule>,
    engine: PasswordEngine,
    budget: BudgetTracker
  ): Promise<void> {
    let attempts = 0;

    let currentBroken = [...broken];

    while (currentBroken.length > 0 && attempts < this.maxAttempts) {
      attempts++;
      const currentBudget = budget.compute(engine);

      const numericBroken = currentBroken.filter(r => r.category === "numeric");
      if (numericBroken.length > 0) {
        const allNumeric = [...allRules.values()].filter(r => r.category === "numeric");
        const solution = this.numericSolver.solveAll(
          allNumeric.map(parseNumericConstraint),
          engine,
          currentBudget
        );

        if (solution) {
          if (solution.digits !== undefined) engine.setZone("digits", solution.digits, 40, []);
          if (solution.roman !== undefined) engine.setZone("roman", solution.roman, 50, []);
          if (solution.elements !== undefined) engine.setZone("elements", solution.elements, 60, []);
        }
      }

      const otherBroken = currentBroken.filter(r => r.category !== "numeric" && r.category !== "human");
      for (const rule of otherBroken) {
        const zone = engine.getZone(`human_${rule.number}`);
        if (zone?.locked) continue;

        const handler = this.handlers.get(rule.category);
        if (!handler) continue;

        const update = await handler.solve(rule, engine, budget);

        const violations = budget.checkProposal(
          engine, update.zone, update.content,
          this.getGlobalConstraints(allRules)
        );

        if (violations.length === 0) {
          engine.setZone(update.zone, update.content, update.priority, [rule.number]);
        } else {
          console.warn(
            `[PWG] Handler for rule #${rule.number} proposed change that would violate: ` +
            violations.map(v => v.constraint).join(", ") +
            " — skipping, will retry"
          );
        }
      }

      // Exit for now, logic will re-run on next tick if still broken
      break; 
    }

    if (currentBroken.length > 0) {
      console.error(`[PWG] ${currentBroken.length} rules unresolvable after ${this.maxAttempts} attempts`);
    }
  }

  private getGlobalConstraints(allRules: Map<number, ClassifiedRule>): GlobalConstraint[] {
    // Collect all global constraints derived from rules
    return [];
  }
}
