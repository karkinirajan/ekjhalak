import assert from "node:assert/strict";
import test from "node:test";

import { sanitizeTextForDisplay, truncate } from "./utils";

test("truncate adds an ellipsis for longer text", () => {
    assert.equal(truncate("hello world", 5), "hello…");
    assert.equal(truncate("short", 20), "short");
});

test("sanitizeTextForDisplay decodes common entities", () => {
    assert.equal(
        sanitizeTextForDisplay("A &amp; B &nbsp; &quot;quoted&quot; &hellip;"),
        'A & B "quoted" …',
    );
    assert.equal(sanitizeTextForDisplay(""), "");
});

test("sanitizeTextForDisplay strips markup as well as decoding entities", () => {
    // The reader-facing last line of defence. Decoding alone turned an escaped
    // `&lt;p&gt;` into a real tag, which React then escaped on render — so the
    // characters "<p>" printed in the middle of a Nepali story.
    assert.equal(sanitizeTextForDisplay("&lt;p&gt;काठमाडौं।&lt;/p&gt;"), "काठमाडौं।");
    assert.equal(sanitizeTextForDisplay("<p>Hello</p>"), "Hello");
    assert.equal(sanitizeTextForDisplay("a&nbsp;b"), "a b");
    assert.equal(sanitizeTextForDisplay("पद्&zwj;मा"), "पद्‍मा");
    // Still leaves legitimate ampersands alone.
    assert.equal(sanitizeTextForDisplay("AT&T"), "AT&T");
});
