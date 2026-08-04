import assert from "node:assert/strict";
import test from "node:test";

import { checkEmail } from "./email-address";
import { rateLimit } from "./rate-limit";

test("checkEmail accepts ordinary addresses", () => {
  for (const email of [
    "reader@example.com",
    "first.last@example.co.uk",
    "reader+news@example.com",
    "r@e.io",
    "नेपाल@example.com",
  ]) {
    assert.deepEqual(checkEmail(email), { ok: true, email }, email);
  }
});

test("checkEmail normalizes case and surrounding space", () => {
  // Folding the local part is technically wrong per the RFC and right in
  // practice: without it Reader@ and reader@ become two subscribers who each
  // get the same briefing.
  assert.deepEqual(checkEmail("  Reader@Example.COM "), {
    ok: true,
    email: "reader@example.com",
  });
});

test("checkEmail rejects malformed shapes", () => {
  for (const bad of [
    "",
    "   ",
    "no-at-sign",
    "@example.com",
    "reader@",
    "reader@localhost",
    "reader@@example.com",
    "reader example@test.com",
    "reader@exa mple.com",
    "two,addresses@example.com",
    "<reader@example.com>",
  ]) {
    assert.equal(checkEmail(bad).ok, false, `expected "${bad}" to fail`);
  }
});

test("checkEmail rejects non-strings and over-long addresses", () => {
  assert.deepEqual(checkEmail(undefined), { ok: false, problem: "empty" });
  assert.deepEqual(checkEmail(42), { ok: false, problem: "empty" });
  assert.deepEqual(checkEmail({}), { ok: false, problem: "empty" });
  assert.deepEqual(checkEmail(`${"a".repeat(250)}@example.com`), {
    ok: false,
    problem: "too-long",
  });
});

test("checkEmail rejects disposable domains", () => {
  assert.deepEqual(checkEmail("someone@mailinator.com"), {
    ok: false,
    problem: "disposable",
  });
  // …and only the domain, not an address that merely mentions one.
  assert.equal(checkEmail("mailinator.com@example.com").ok, true);
});

test("rateLimit allows up to the limit then blocks within the window", () => {
  const now = 1_000_000;
  const key = `test-${Math.random()}`;
  for (let i = 0; i < 3; i++) {
    assert.equal(rateLimit(key, 3, 60_000, now).allowed, true, `call ${i + 1}`);
  }
  const blocked = rateLimit(key, 3, 60_000, now);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfter > 0);
});

test("rateLimit reopens once the window has passed", () => {
  const now = 2_000_000;
  const key = `test-${Math.random()}`;
  assert.equal(rateLimit(key, 1, 60_000, now).allowed, true);
  assert.equal(rateLimit(key, 1, 60_000, now).allowed, false);
  assert.equal(rateLimit(key, 1, 60_000, now + 60_001).allowed, true);
});

test("rateLimit keys are independent", () => {
  const now = 3_000_000;
  const a = `a-${Math.random()}`;
  const b = `b-${Math.random()}`;
  assert.equal(rateLimit(a, 1, 60_000, now).allowed, true);
  assert.equal(rateLimit(a, 1, 60_000, now).allowed, false);
  assert.equal(rateLimit(b, 1, 60_000, now).allowed, true);
});
