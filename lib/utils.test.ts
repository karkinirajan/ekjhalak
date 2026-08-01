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
