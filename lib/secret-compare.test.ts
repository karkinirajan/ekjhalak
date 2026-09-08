import assert from "node:assert/strict";
import test from "node:test";

import { secretsMatch } from "./secret-compare";

test("an identical secret matches", () => {
  assert.equal(secretsMatch("s3cr3t-value", "s3cr3t-value"), true);
});

test("a different secret of the same length does not match", () => {
  assert.equal(secretsMatch("s3cr3t-value", "s3cr3t-valuX"), false);
});

test("a different length does not match, and does not throw", () => {
  // timingSafeEqual throws on unequal lengths; the guard must catch that before
  // it reaches the comparison rather than 500-ing the route.
  assert.equal(secretsMatch("short", "a-much-longer-secret"), false);
  assert.equal(secretsMatch("a-much-longer-secret", "short"), false);
});

test("a missing presented secret does not match", () => {
  assert.equal(secretsMatch(null, "expected"), false);
  assert.equal(secretsMatch("", "expected"), false);
});

test("multi-byte characters compare by their bytes, not their length in code units", () => {
  assert.equal(secretsMatch("नेपाल", "नेपाल"), true);
  assert.equal(secretsMatch("नेपाल", "नेपला"), false);
});
