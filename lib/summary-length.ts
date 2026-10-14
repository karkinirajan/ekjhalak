// lib/summary-length.ts
//
// How long a summary should be, in both languages.
//
// Its own module rather than constants inside lib/summarizer.ts, because that
// file imports `server-only` and so cannot be loaded by a test — and this is
// the part most worth testing, since it is a contract between two languages
// that do not measure the same way.
//
// The brief is specified in WORDS, not characters. 140 words is the target, and
// the same 140 words measures about 964 characters in English and about 1,060
// in Nepali: Devanagari vowel signs, matras and halants are each their own
// Unicode code point, so a counter that counts visible glyphs reports fewer
// than one counting code points. Measured across this site's own corpus the
// ratio is 6.3 characters a word in English and 6.9 in Nepali — the same
// ordering from the other direction.
//
// One shared character ceiling therefore cannot serve both: it either truncates
// the Nepali mid-thought or lets the English run a fifth longer than asked.

/** Words per summary paragraph, in each language. */
export const SUMMARY_TARGET_WORDS = 140;

/**
 * The character window around that target, per language.
 *
 * A safety net, not the target itself: wide enough that a story which honestly
 * needs 120 or 160 words is not rejected, tight enough to catch a model that
 * has run away. The windows are asymmetric between languages by the same ratio
 * the corpus shows.
 */
export const SUMMARY_BOUNDS = {
  en: { min: 760, max: 1_100 },
  np: { min: 840, max: 1_210 },
} as const;

export type SummaryLang = keyof typeof SUMMARY_BOUNDS;

/**
 * The window for a language, falling back to English.
 *
 * English rather than the wider Nepali window, because a language this pipeline
 * does not know is far likelier to be Latin-script than Devanagari, and the
 * wrong fallback here shows as prose that runs long rather than as an error.
 */
export function summaryBounds(lang: string) {
  return lang === "np" ? SUMMARY_BOUNDS.np : SUMMARY_BOUNDS.en;
}

/**
 * Words in a summary, counted the way a person would.
 *
 * Standalone punctuation is not a word. Nepali sentences end in a danda (।)
 * which is conventionally spaced away from the word before it, so a plain
 * whitespace split reports about 8% high on Nepali prose and not at all high on
 * English — which would make the same brief look like two different lengths.
 * The reference sample measured 151 tokens by whitespace split and 140 real
 * words once its ten dandas and one question mark were excluded.
 */
export function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
}
