import { ClassifiedRule } from "../../shared/types";

export class RuleClassifier {
  classify(text: string): string {
    const t = text.toLowerCase();
    
    // Numeric rules (digits, roman, atomic sum)
    if ((/digits/i.test(t) && /add\s+up/i.test(t)) || /roman/i.test(t) || /atomic/i.test(t)) {
      return "numeric";
    }
    
    if (/wordle/i.test(t) || /youtube/i.test(t) || /country/i.test(t) || /chess/i.test(t)) {
      return "external";
    }
    
    if (/captcha/i.test(t) || /maps/i.test(t) || /geoguessr/i.test(t)) {
      return "human";
    }

    if (/month/i.test(t)) {
      return "pattern";
    }

    if (/time/i.test(t)) {
      return "time";
    }

    if (/at\s+least/i.test(t) || /include/i.test(t) || /special\s+character/i.test(t)) {
      return "text";
    }

    return "text";
  }
}
