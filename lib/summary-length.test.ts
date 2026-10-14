import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  SUMMARY_BOUNDS,
  SUMMARY_TARGET_WORDS,
  summaryBounds,
} from "./summary-length";

/**
 * The brief is 140 words in both languages. These tests pin the character
 * windows to that target rather than to whatever the constants happen to say,
 * so a future edit that drifts the two apart fails here.
 *
 * Measured ratios from this site's own corpus: 6.3 characters a word in
 * English, 6.9 in Nepali. The reference samples the target came from measured
 * 6.89 and 7.57 — wordier prose, same ordering. The windows have to contain
 * both readings of "140 words".
 */
const EN_CHARS_PER_WORD = [6.3, 6.89];
const NP_CHARS_PER_WORD = [6.94, 7.57];

describe("summary length contract", () => {
  it("targets 140 words", () => {
    assert.equal(SUMMARY_TARGET_WORDS, 140);
  });

  it("gives Nepali a higher ceiling than English", () => {
    // Devanagari matras and halants are each their own code point, so the same
    // word count measures longer. A shared ceiling would cut Nepali short.
    assert.ok(
      SUMMARY_BOUNDS.np.max > SUMMARY_BOUNDS.en.max,
      `np max ${SUMMARY_BOUNDS.np.max} must exceed en max ${SUMMARY_BOUNDS.en.max}`,
    );
    assert.ok(SUMMARY_BOUNDS.np.min > SUMMARY_BOUNDS.en.min);
  });

  it("contains both readings of 140 words in English", () => {
    for (const ratio of EN_CHARS_PER_WORD) {
      const chars = SUMMARY_TARGET_WORDS * ratio;
      assert.ok(
        chars >= SUMMARY_BOUNDS.en.min && chars <= SUMMARY_BOUNDS.en.max,
        `${Math.round(chars)} chars (${ratio}/word) outside ${SUMMARY_BOUNDS.en.min}-${SUMMARY_BOUNDS.en.max}`,
      );
    }
  });

  it("contains both readings of 140 words in Nepali", () => {
    for (const ratio of NP_CHARS_PER_WORD) {
      const chars = SUMMARY_TARGET_WORDS * ratio;
      assert.ok(
        chars >= SUMMARY_BOUNDS.np.min && chars <= SUMMARY_BOUNDS.np.max,
        `${Math.round(chars)} chars (${ratio}/word) outside ${SUMMARY_BOUNDS.np.min}-${SUMMARY_BOUNDS.np.max}`,
      );
    }
  });

  it("leaves room on both sides of the target rather than clamping to it", () => {
    // A story that honestly needs 120 or 160 words must not be rejected.
    for (const lang of ["en", "np"] as const) {
      const b = SUMMARY_BOUNDS[lang];
      const mid = (b.min + b.max) / 2;
      assert.ok(b.max - mid > mid * 0.14, `${lang} window too tight above target`);
      assert.ok(mid - b.min > mid * 0.14, `${lang} window too tight below target`);
    }
  });

  it("resolves an unknown language to the English window", () => {
    assert.deepEqual(summaryBounds("fr"), SUMMARY_BOUNDS.en);
    assert.deepEqual(summaryBounds("np"), SUMMARY_BOUNDS.np);
  });
});
