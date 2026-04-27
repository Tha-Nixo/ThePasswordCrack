export interface PasswordBudget {
  totalLength: number;          // charCount(), NOT .length
  totalCodeUnits: number;       // .length (for JS string operations)
  digitCount: number;           // digitCount()
  uppercaseCount: number;       // uppercaseCount()
  lowercaseCount: number;       // lowercaseCount()
  specialCount: number;
  romanCharCount: number;
  romanValueFromOtherZones: number;
  romanProductFromOtherZones: number;
  digitSumFromOtherZones: number;
}

export interface Zone {
  content: string;
  locked: boolean;
  priority: number;
  ruleDependencies: number[];
}

export interface ClassifiedRule {
  number: number;
  text: string;
  satisfied: boolean;
  category: string;
  zoneId?: string;
}

export interface ConstraintViolation {
  constraint: string;
  message: string;
}

export interface ZoneUpdate {
  zone: string;
  content: string;
  priority: number;
}

export interface GlobalConstraint {
  name: string;
  check: (budget: PasswordBudget) => boolean;
  describe: (budget: PasswordBudget) => string;
}

export interface NumericConstraint {
  type: "sum" | "ratio" | "roman_presence" | "roman_multiply" | "atomic_sum";
  target?: number;
  maxRatio?: number;
}

export interface Handler {
  solve(rule: ClassifiedRule, engine: any, budgetTracker: any): Promise<ZoneUpdate>;
}
