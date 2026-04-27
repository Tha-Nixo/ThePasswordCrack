/**
 * Periodic Table data and element scanning utilities
 * for The Password Game's "atomic numbers must add up to X" rule.
 */

// Two-letter symbols mapped to atomic number
const ELEMENTS_2: Record<string, number> = {
  he:2, li:3, be:4, ne:10, na:11, mg:12, al:13, si:14, cl:17, ar:18,
  ca:20, sc:21, ti:22, cr:24, mn:25, fe:26, co:27, ni:28, cu:29, zn:30,
  ga:31, ge:32, as:33, se:34, br:35, kr:36, rb:37, sr:38, zr:40, nb:41,
  mo:42, tc:43, ru:44, rh:45, pd:46, ag:47, cd:48, in:49, sn:50, sb:51,
  te:52, xe:54, cs:55, ba:56, la:57, ce:58, pr:59, nd:60, pm:61, sm:62,
  eu:63, gd:64, tb:65, dy:66, ho:67, er:68, tm:69, yb:70, lu:71, hf:72,
  ta:73, re:75, os:76, ir:77, pt:78, au:79, hg:80, tl:81, pb:82, bi:83,
  po:84, at:85, rn:86, fr:87, ra:88, ac:89, th:90, pa:91, np:93, pu:94,
  am:95, cm:96, bk:97, cf:98, es:99, fm:100, md:101, no:102, lr:103,
  rf:104, db:105, sg:106, bh:107, hs:108, mt:109, ds:110, rg:111, cn:112,
  nh:113, fl:114, mc:115, lv:116, ts:117, og:118
};

// One-letter symbols mapped to atomic number
const ELEMENTS_1: Record<string, number> = {
  h:1, b:5, c:6, n:7, o:8, f:9, p:15, s:16, k:19, v:23,
  y:39, i:53, w:74, u:92
};

/**
 * Scan a string for periodic table elements using a greedy left-to-right algorithm.
 * Prefers 2-letter symbols over 1-letter symbols (same as the Password Game).
 * Returns the total atomic number sum.
 */
export function scanElements(text: string): { sum: number; found: { symbol: string; atomicNumber: number }[] } {
  const lower = text.toLowerCase().replace(/[^a-z]/g, ""); // strip non-alpha
  const found: { symbol: string; atomicNumber: number }[] = [];
  let sum = 0;
  let i = 0;

  while (i < lower.length) {
    // Try 2-letter symbol first
    if (i + 1 < lower.length) {
      const twoChar = lower.substring(i, i + 2);
      if (ELEMENTS_2[twoChar] !== undefined) {
        const an = ELEMENTS_2[twoChar];
        found.push({ symbol: twoChar, atomicNumber: an });
        sum += an;
        i += 2;
        continue;
      }
    }
    // Try 1-letter symbol
    const oneChar = lower[i];
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
