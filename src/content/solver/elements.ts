/**
 * Periodic Table data and element scanning utilities
 * for The Password Game's "atomic numbers must add up to X" rule.
 */

// Two-letter symbols mapped to atomic number
const ELEMENTS_2: Record<string, number> = {
  He:2, Li:3, Be:4, Ne:10, Na:11, Mg:12, Al:13, Si:14, Cl:17, Ar:18,
  Ca:20, Sc:21, Ti:22, Cr:24, Mn:25, Fe:26, Co:27, Ni:28, Cu:29, Zn:30,
  Ga:31, Ge:32, As:33, Se:34, Br:35, Kr:36, Rb:37, Sr:38, Zr:40, Nb:41,
  Mo:42, Tc:43, Ru:44, Rh:45, Pd:46, Ag:47, Cd:48, In:49, Sn:50, Sb:51,
  Te:52, Xe:54, Cs:55, Ba:56, La:57, Ce:58, Pr:59, Nd:60, Pm:61, Sm:62,
  Eu:63, Gd:64, Tb:65, Dy:66, Ho:67, Er:68, Tm:69, Yb:70, Lu:71, Hf:72,
  Ta:73, Re:75, Os:76, Ir:77, Pt:78, Au:79, Hg:80, Tl:81, Pb:82, Bi:83,
  Po:84, At:85, Rn:86, Fr:87, Ra:88, Ac:89, Th:90, Pa:91, Np:93, Pu:94,
  Am:95, Cm:96, Bk:97, Cf:98, Es:99, Fm:100, Md:101, No:102, Lr:103,
  Rf:104, Db:105, Sg:106, Bh:107, Hs:108, Mt:109, Ds:110, Rg:111, Cn:112,
  Nh:113, Fl:114, Mc:115, Lv:116, Ts:117, Og:118
};

// One-letter symbols mapped to atomic number
const ELEMENTS_1: Record<string, number> = {
  H:1, B:5, C:6, N:7, O:8, F:9, P:15, S:16, K:19, V:23,
  Y:39, I:53, W:74, U:92
};

/**
 * Scan a string for periodic table elements using a greedy left-to-right algorithm.
 * Prefers 2-letter symbols over 1-letter symbols (same as the Password Game).
 * Returns the total atomic number sum.
 */
export function scanElements(text: string): { sum: number; found: { symbol: string; atomicNumber: number }[] } {
  const clean = text.replace(/[^a-zA-Z]/g, ""); // strip non-alpha
  const found: { symbol: string; atomicNumber: number }[] = [];
  let sum = 0;
  let i = 0;

  while (i < clean.length) {
    // Try 2-letter symbol first
    if (i + 1 < clean.length) {
      const twoChar = clean.substring(i, i + 2);
      if (ELEMENTS_2[twoChar] !== undefined) {
        const an = ELEMENTS_2[twoChar];
        found.push({ symbol: twoChar, atomicNumber: an });
        sum += an;
        i += 2;
        continue;
      }
    }
    // Try 1-letter symbol
    const oneChar = clean[i];
    if (ELEMENTS_1[oneChar] !== undefined) {
      const an = ELEMENTS_1[oneChar];
      found.push({ symbol: oneChar, atomicNumber: an });
      sum += an;
    }
    i += 1;
  }

  return { sum, found };
}

/**
 * Generate a string of element symbols that adds up to exactly `targetSum` in atomic numbers.
 * Uses high-atomic-number 2-letter elements to minimize string length.
 * Returns null if impossible (shouldn't happen for reasonable targets).
 */
export function generateElementString(targetSum: number): string | null {
  if (targetSum <= 0) return "";

  // Use clearly recognizable elements that won't be ambiguous
  // Prefer high atomic numbers to minimize characters
  const candidates: { symbol: string; atomicNumber: number }[] = [
    { symbol: "Og", atomicNumber: 118 },
    { symbol: "Ts", atomicNumber: 117 },
    { symbol: "Lv", atomicNumber: 116 },
    { symbol: "Mc", atomicNumber: 115 },
    { symbol: "Fl", atomicNumber: 114 },
    { symbol: "Nh", atomicNumber: 113 },
    { symbol: "Cn", atomicNumber: 112 },
    { symbol: "Rg", atomicNumber: 111 },
    { symbol: "Ds", atomicNumber: 110 },
    { symbol: "Mt", atomicNumber: 109 },
    { symbol: "Hs", atomicNumber: 108 },
    { symbol: "Bh", atomicNumber: 107 },
    { symbol: "Sg", atomicNumber: 106 },
    { symbol: "Db", atomicNumber: 105 },
    { symbol: "Rf", atomicNumber: 104 },
    { symbol: "Lr", atomicNumber: 103 },
    { symbol: "No", atomicNumber: 102 },
    { symbol: "Md", atomicNumber: 101 },
    { symbol: "Fm", atomicNumber: 100 },
    { symbol: "Es", atomicNumber: 99 },
    { symbol: "Cf", atomicNumber: 98 },
    { symbol: "Bk", atomicNumber: 97 },
    { symbol: "Cm", atomicNumber: 96 },
    { symbol: "Am", atomicNumber: 95 },
    { symbol: "Pu", atomicNumber: 94 },
    { symbol: "Np", atomicNumber: 93 },
    { symbol: "Th", atomicNumber: 90 },
    { symbol: "Ac", atomicNumber: 89 },
    { symbol: "Ra", atomicNumber: 88 },
    { symbol: "Fr", atomicNumber: 87 },
    { symbol: "Rn", atomicNumber: 86 },
    { symbol: "At", atomicNumber: 85 },
    { symbol: "Po", atomicNumber: 84 },
    { symbol: "Bi", atomicNumber: 83 },
    { symbol: "Pb", atomicNumber: 82 },
    { symbol: "Tl", atomicNumber: 81 },
    { symbol: "Hg", atomicNumber: 80 },
    { symbol: "Au", atomicNumber: 79 },
    { symbol: "Pt", atomicNumber: 78 },
    { symbol: "Ir", atomicNumber: 77 },
    { symbol: "Os", atomicNumber: 76 },
    { symbol: "Re", atomicNumber: 75 },
    { symbol: "Ta", atomicNumber: 73 },
    { symbol: "Hf", atomicNumber: 72 },
    { symbol: "Lu", atomicNumber: 71 },
    { symbol: "Yb", atomicNumber: 70 },
    { symbol: "Tm", atomicNumber: 69 },
    { symbol: "Er", atomicNumber: 68 },
    { symbol: "Ho", atomicNumber: 67 },
    { symbol: "Dy", atomicNumber: 66 },
    { symbol: "Tb", atomicNumber: 65 },
    { symbol: "Gd", atomicNumber: 64 },
    { symbol: "Eu", atomicNumber: 63 },
    { symbol: "Sm", atomicNumber: 62 },
    { symbol: "Nd", atomicNumber: 60 },
    { symbol: "Pr", atomicNumber: 59 },
    { symbol: "Ce", atomicNumber: 58 },
    { symbol: "La", atomicNumber: 57 },
    { symbol: "Ba", atomicNumber: 56 },
    { symbol: "Cs", atomicNumber: 55 },
    { symbol: "Xe", atomicNumber: 54 },
    { symbol: "Te", atomicNumber: 52 },
    { symbol: "Sb", atomicNumber: 51 },
    { symbol: "Sn", atomicNumber: 50 },
    { symbol: "In", atomicNumber: 49 },
    { symbol: "Cd", atomicNumber: 48 },
    { symbol: "Ag", atomicNumber: 47 },
    { symbol: "Pd", atomicNumber: 46 },
    { symbol: "Rh", atomicNumber: 45 },
    { symbol: "Ru", atomicNumber: 44 },
    { symbol: "Tc", atomicNumber: 43 },
    { symbol: "Mo", atomicNumber: 42 },
    { symbol: "Nb", atomicNumber: 41 },
    { symbol: "Zr", atomicNumber: 40 },
    { symbol: "Sr", atomicNumber: 38 },
    { symbol: "Rb", atomicNumber: 37 },
    { symbol: "Kr", atomicNumber: 36 },
    { symbol: "Br", atomicNumber: 35 },
    { symbol: "Se", atomicNumber: 34 },
    { symbol: "As", atomicNumber: 33 },
    { symbol: "Ge", atomicNumber: 32 },
    { symbol: "Ga", atomicNumber: 31 },
    { symbol: "Zn", atomicNumber: 30 },
    { symbol: "Cu", atomicNumber: 29 },
    { symbol: "Ni", atomicNumber: 28 },
    { symbol: "Co", atomicNumber: 27 },
    { symbol: "Fe", atomicNumber: 26 },
    { symbol: "Mn", atomicNumber: 25 },
    { symbol: "Cr", atomicNumber: 24 },
    { symbol: "Ti", atomicNumber: 22 },
    { symbol: "Sc", atomicNumber: 21 },
    { symbol: "Ca", atomicNumber: 20 },
    { symbol: "Ar", atomicNumber: 18 },
    { symbol: "Cl", atomicNumber: 17 },
    { symbol: "Si", atomicNumber: 14 },
    { symbol: "Al", atomicNumber: 13 },
    { symbol: "Mg", atomicNumber: 12 },
    { symbol: "Na", atomicNumber: 11 },
    { symbol: "Ne", atomicNumber: 10 },
    { symbol: "Be", atomicNumber: 4 },
    { symbol: "Li", atomicNumber: 3 },
    { symbol: "He", atomicNumber: 2 },
  ];

  // Also include 1-letter elements for fine-tuning small remainders
  const single: { symbol: string; atomicNumber: number }[] = [
    { symbol: "U", atomicNumber: 92 },
    { symbol: "W", atomicNumber: 74 },
    { symbol: "I", atomicNumber: 53 },
    { symbol: "Y", atomicNumber: 39 },
    { symbol: "K", atomicNumber: 19 },
    { symbol: "S", atomicNumber: 16 },
    { symbol: "P", atomicNumber: 15 },
    { symbol: "F", atomicNumber: 9 },
    { symbol: "O", atomicNumber: 8 },
    { symbol: "N", atomicNumber: 7 },
    { symbol: "C", atomicNumber: 6 },
    { symbol: "B", atomicNumber: 5 },
    { symbol: "H", atomicNumber: 1 },
  ];

  const allElements = [...candidates, ...single];
  const result: string[] = [];
  let remaining = targetSum;

  // Greedy: pick largest element that fits
  for (const el of allElements) {
    while (remaining >= el.atomicNumber) {
      result.push(el.symbol);
      remaining -= el.atomicNumber;
    }
    if (remaining === 0) break;
  }

  if (remaining !== 0) return null; // shouldn't happen since H=1

  return result.join("");
}
