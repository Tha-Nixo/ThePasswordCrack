// shared/unicode.ts — IMPORT THIS EVERYWHERE STRINGS ARE MEASURED

/**
 * Unicode-safe string utilities.
 *
 * JavaScript .length counts UTF-16 code units, not characters.
 * "🌕".length === 2, but it's visually 1 character.
 * "👨👩👧👦".length === 11, but it's visually 1 character.
 *
 * We use Array.from() which splits by grapheme clusters in most cases,
 * and Intl.Segmenter for full grapheme-correct counting.
 */

/** Count visual characters (grapheme clusters). */
function charCount(s: string): number {
  // Intl.Segmenter is the correct solution (Chrome 87+)
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
    return [...segmenter.segment(s)].length;
  }
  // Fallback: Array.from splits by code points (handles most emoji, not ZWJ sequences)
  return Array.from(s).length;
}

/** 
 * KNOWN LIMITATION: /^\d$/ matches only ASCII digits 0-9.
 * Unicode digits (e.g., ٣ Arabic, ३ Devanagari) won't match.
 *
 * The Password Game almost certainly uses ASCII-only digit checking
 * (it's a JS game, and JS parseInt/Number only work with ASCII digits).
 *
 * If this assumption is wrong (you'll notice digit sum rules not working),
 * replace /^\d$/ with /^\p{Nd}$/u (Unicode Number, Decimal Digit).
 *
 * For now: ASCII-only is correct and intentional.
 */
function digitCount(s: string): number {
  return Array.from(s).filter(c => /^\d$/.test(c)).length;
}

/** Count uppercase letters (Unicode-safe). */
function uppercaseCount(s: string): number {
  return Array.from(s).filter(c => c !== c.toLowerCase() && c === c.toUpperCase()).length;
}

/** Count lowercase letters. */
function lowercaseCount(s: string): number {
  return Array.from(s).filter(c => c !== c.toUpperCase() && c === c.toLowerCase()).length;
}

/** Sum of all digit characters. */
function digitSum(s: string): number {
  return Array.from(s)
    .filter(c => /^\d$/.test(c))
    .reduce((sum, d) => sum + parseInt(d), 0);
}

/** Extract only roman numeral characters. */
function romanChars(s: string): string {
  return Array.from(s).filter(c => "IVXLCDM".includes(c)).join("");
}

export function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, "");
}

export { charCount, digitCount, uppercaseCount, lowercaseCount, digitSum, romanChars };
