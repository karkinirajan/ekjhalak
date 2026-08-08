import assert from "node:assert/strict";
import test from "node:test";

import { EXCERPT_MAX_CHARS, isTruncated, storyExcerpt } from "./story-excerpt";

const sentence = (n: number) => `Sentence number ${n} runs on for a while. `;
const long = sentence(1).repeat(100);

test("text already under the cap is returned untouched", () => {
    const short = "A short brief about one thing.";
    assert.equal(storyExcerpt(short), short);
    assert.equal(isTruncated(short), false);
});

test("nothing ever renders past the cap", () => {
    // The whole point of the module. If this fails, the display cap is gone.
    assert.ok(storyExcerpt(long).length <= EXCERPT_MAX_CHARS);
    assert.ok(storyExcerpt(long, 120).length <= 120);
    assert.equal(isTruncated(long), true);
});

test("truncation prefers a sentence boundary", () => {
    const out = storyExcerpt(long);
    assert.ok(/\.$/.test(out), `expected a full stop, got: ${JSON.stringify(out.slice(-30))}`);
    assert.ok(!out.endsWith("…"));
});

test("a Devanagari danda counts as a sentence boundary", () => {
    const np = "यो पहिलो वाक्य हो। ".repeat(150);
    const out = storyExcerpt(np);
    assert.ok(out.length <= EXCERPT_MAX_CHARS);
    assert.ok(out.endsWith("।"), `expected a danda, got: ${JSON.stringify(out.slice(-20))}`);
});

test("a first sentence longer than the cap falls back to a word boundary", () => {
    // No boundary anywhere in the window, so the sentence rule cannot apply.
    const noStops = "word ".repeat(600);
    const out = storyExcerpt(noStops);
    assert.ok(out.length <= EXCERPT_MAX_CHARS);
    assert.ok(out.endsWith("…"));
    assert.ok(!/\bwor…$/.test(out), "cut a word in half");
});

test("a sentence boundary too early in the window is not used", () => {
    // "Hi. " ends at character 4 — using it would return four characters where
    // 2500 were available.
    const text = `Hi. ${"a".repeat(3000)}`;
    const out = storyExcerpt(text);
    assert.ok(out.length > EXCERPT_MAX_CHARS * 0.5, `got ${out.length} chars`);
});

test("surrounding whitespace never survives", () => {
    assert.equal(storyExcerpt("   padded   "), "padded");
    assert.equal(isTruncated(`  ${"x".repeat(EXCERPT_MAX_CHARS)}  `), false);
});

test("an empty summary stays empty rather than becoming an ellipsis", () => {
    assert.equal(storyExcerpt(""), "");
    assert.equal(storyExcerpt("   "), "");
});
