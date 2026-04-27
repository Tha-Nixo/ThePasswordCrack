import { ClassifiedRule, Handler, ZoneUpdate } from "../../shared/types";
import { PasswordEngine } from "../password-engine";
import { BudgetTracker } from "../solver/budget";
import { DOMWriter } from "../dom-writer";

export class SacrificeHandler implements Handler {
  constructor(private domWriter: DOMWriter) {}

  async solve(rule: ClassifiedRule, engine: PasswordEngine, budgetTracker: BudgetTracker): Promise<ZoneUpdate> {
    if (engine.getZone("sacrifice")?.locked) {
      return { zone: "sacrifice", content: "", priority: 99 };
    }

    const password = engine.getPassword().toUpperCase();
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const unused: string[] = [];

    for (const char of alphabet) {
      if (!password.includes(char)) {
        unused.push(char);
      }
    }

    if (unused.length >= 2) {
      const letters: [string, string] = [unused[0], unused[1]];
      console.log(`[PWG] 🩸 Sacrificing letters: ${letters[0]}, ${letters[1]}`);
      await this.domWriter.sacrificeLetters(letters);
    } else {
      console.warn("[PWG] ⚠️ Not enough unused letters to sacrifice!");
    }

    // Return a dummy zone that gets locked so we don't try to sacrifice again
    return {
      zone: "sacrifice",
      content: "",
      priority: 99
    };
  }
}
