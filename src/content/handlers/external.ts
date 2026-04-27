import { ClassifiedRule, Handler, ZoneUpdate } from "../../shared/types";
import { PasswordEngine } from "../password-engine";
import { BudgetTracker } from "../solver/budget";
import { HumanHandler } from "./human";

export class ExternalHandler implements Handler {
  constructor(private humanHandler: HumanHandler) {}

  async solve(rule: ClassifiedRule, engine: PasswordEngine, budgetTracker: BudgetTracker): Promise<ZoneUpdate> {
    if (rule.text.includes("Wordle") || rule.text.includes("wordle")) {
      return this.solveWordle(rule, engine);
    }
    if (rule.text.includes("YouTube") || rule.text.includes("youtube")) {
      return this.solveYouTube(rule, engine);
    }
    if (rule.text.toLowerCase().includes("country")) {
      return this.solveCountry(rule);
    }
    if (rule.text.toLowerCase().includes("chess")) {
      return this.solveChess(rule);
    }
    
    return this.fallbackToHuman(rule, "External rule requiring manual input:");
  }

  async solveCountry(rule: ClassifiedRule): Promise<ZoneUpdate> {
    // Wait up to 3 seconds for the spy to capture the country from includes() checks
    const country = await this.waitForCountry(3000);
    if (country) {
      console.log(`[PWG] 🗺️ Auto-solved GeoGuessr: ${country}`);
      return { zone: "country", content: country, priority: 85 };
    }
    
    console.warn("[PWG] GeoGuessr country not available automatically, asking user.");
    return this.fallbackToHuman(rule, "GeoGuessr: What country is shown on the map?");
  }

  private async waitForCountry(timeoutMs: number): Promise<string | null> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const country = (window as any).__pwgCountryAnswer;
      if (country && typeof country === 'string' && country.length > 2 && !/[\\^$.*+?()[\]{}|]/.test(country)) {
        return country;
      }
      await new Promise(r => setTimeout(r, 200));
    }
    return null;
  }

  async solveChess(rule: ClassifiedRule): Promise<ZoneUpdate> {
    // Wait up to 5 seconds for the spy to capture the chess move from includes() checks
    const move = await this.waitForChessMove(5000);
    if (move) {
      console.log(`[PWG] ♟️ Auto-solved chess: ${move}`);
      return { zone: "chess", content: move, priority: 86 };
    }
    
    console.warn("[PWG] Chess move not available automatically, asking user.");
    return this.fallbackToHuman(rule, "Chess: What is the best move in algebraic notation?");
  }

  private async waitForChessMove(timeoutMs: number): Promise<string | null> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const move = (window as any).__pwgChessAnswer;
      if (move && typeof move === 'string' && move.length >= 2) {
        return move;
      }
      await new Promise(r => setTimeout(r, 200));
    }
    return null;
  }

  async solveWordle(rule: ClassifiedRule, engine: PasswordEngine): Promise<ZoneUpdate> {
    const answer = await this.tryWithTimeout(async () => {
      const domAnswer = this.findWordleInDOM();
      if (domAnswer) return domAnswer;

      try {
        const d = new Date();
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const url = `https://www.nytimes.com/svc/wordle/v2/${yyyy}-${mm}-${dd}.json`;
        
        const response = await new Promise<any>((resolve) => {
          chrome.runtime.sendMessage({ type: "FETCH_WORDLE", url }, (res) => resolve(res));
        });
        
        if (response && response.success && response.data && response.data.solution) {
          return response.data.solution.toLowerCase();
        }
      } catch (e) { console.warn("[PWG] Wordle fetch error:", e); }

      return null;
    }, 5000);

    if (answer) {
      return { zone: "wordle", content: answer, priority: 35 };
    }

    console.warn("[PWG] Could not fetch Wordle answer automatically — asking user");
    return this.fallbackToHuman(rule, "What is today's Wordle answer? (5 letters)");
  }

  async solveYouTube(rule: ClassifiedRule, engine: PasswordEngine): Promise<ZoneUpdate> {
    const durationMatch = rule.text.match(/(\d+)\s*minutes?\s*(?:and\s*)?(\d+)\s*seconds?/i);
    if (durationMatch) {
      const mins = parseInt(durationMatch[1]);
      const secs = parseInt(durationMatch[2]);
      const formatted = `${mins}:${secs.toString().padStart(2, "0")}`;
    }

    return this.fallbackToHuman(rule,
      "This rule requires a YouTube URL. Please find a video matching the required duration and paste the URL:"
    );
  }

  private async fallbackToHuman(rule: ClassifiedRule, prompt: string): Promise<ZoneUpdate> {
    const input = await this.humanHandler.requestInput(rule, prompt);
    return {
      zone: `external_${rule.number}`,
      content: input,
      priority: 85,
    };
  }

  private async tryWithTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T | null> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), timeoutMs);
      fn().then(res => {
        clearTimeout(timer);
        resolve(res);
      }).catch(() => {
        clearTimeout(timer);
        resolve(null);
      });
    });
  }

  private findWordleInDOM(): string | null {
    // INSPECT_LIVE_PAGE
    return null; 
  }
}
