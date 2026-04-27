import { ClassifiedRule, Handler, ZoneUpdate } from "../../shared/types";
import { PasswordEngine } from "../password-engine";
import { BudgetTracker } from "../solver/budget";

export class TextHandler implements Handler {
  async solve(rule: ClassifiedRule, engine: PasswordEngine, budgetTracker: BudgetTracker): Promise<ZoneUpdate> {
    const t = rule.text.toLowerCase();

    if (t.includes("sponsor")) {
      return {
        zone: "sponsor",
        content: "pepsi",
        priority: 65
      };
    }
    
    if (t.includes("moon")) {
      return {
        zone: "moon",
        content: this.getMoonPhase(),
        priority: 60
      };
    }

    if (t.includes("periodic") || t.includes("symbol")) {
      return {
        zone: "periodic",
        content: "He",
        priority: 15
      };
    }

    if (t.includes("leap year")) {
      return {
        zone: "leapyear",
        content: "2000",
        priority: 50
      };
    }

    if (t.includes("paul") && (t.includes("feed") || t.includes("eats") || t.includes("🐛"))) {
      return {
        zone: "egg",
        content: "🐔🐛🐛🐛",
        priority: 70
      };
    }

    if (t.includes("chicken") || t.includes("paul") || t.includes("hatched") || t.includes("🥚")) {
      return {
        zone: "egg",
        content: "🥚",
        priority: 70
      };
    }
    
    if (t.includes("strong")) {
      return {
        zone: "strong",
        content: "🏋️‍♂️🏋️‍♂️🏋️‍♂️",
        priority: 75
      };
    }

    if (t.includes("affirmation") || t.includes("loved") || t.includes("worthy") || t.includes("enough")) {
      return {
        zone: "affirmation",
        content: "i am loved",
        priority: 76
      };
    }

    if (t.includes("color in hex")) {
      const hexMatch = rule.text.match(/#[0-9a-fA-F]{6}/);
      if (hexMatch) {
        return {
          zone: "color_hex",
          content: hexMatch[0],
          priority: 80
        };
      }
    }


    return {
      zone: "text",
      content: "", // placeholder, engine initialization handles the default base nicely
      priority: 20
    };
  }

  private getMoonPhase(date = new Date()): string {
    const lp = 2551443; 
    const now = date.getTime() / 1000;
    const newMoon = 947182440;
    const phase = ((now - newMoon) % lp) / lp;
    
    if (phase < 0.03 || phase > 0.97) return "🌑"; // New Moon
    if (phase < 0.22) return "🌒"; // Waxing Crescent
    if (phase < 0.28) return "🌓"; // First Quarter
    if (phase < 0.47) return "🌔"; // Waxing Gibbous
    if (phase < 0.53) return "🌕"; // Full Moon
    if (phase < 0.72) return "🌖"; // Waning Gibbous
    if (phase < 0.78) return "🌗"; // Last Quarter
    return "🌘"; // Waning Crescent
  }
}
