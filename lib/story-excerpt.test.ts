import assert from "node:assert/strict";
import test from "node:test";

import { isTruncated, storyExcerpt } from "./story-excerpt";

const sentence = (n: number) => `Sentence number ${n} runs on for a while. `;
const long = sentence(1).repeat(40);

test("text already under the cap is returned untouched", () => {
    const short = "A short brief about one thing.";
    assert.equal(storyExcerpt(short), short);
    assert.equal(isTruncated(short), false);
});

test("text is returned untouched regardless of length", () => {
    const short = "A short brief about one thing.";
    assert.equal(storyExcerpt(short), short);
    assert.equal(isTruncated(short), false);

    assert.equal(storyExcerpt(long), long.trim());
    assert.equal(isTruncated(long), false);
});

test("surrounding whitespace never survives", () => {
    assert.equal(storyExcerpt("   padded   "), "padded");
    assert.equal(isTruncated(`  ${"x".repeat(400)}  `), false);
});

test("an empty summary stays empty rather than becoming an ellipsis", () => {
    assert.equal(storyExcerpt(""), "");
    assert.equal(storyExcerpt("   "), "");
});
