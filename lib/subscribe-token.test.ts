import assert from "node:assert/strict";
import test from "node:test";

import {
  createConfirmationToken,
  isTokenSigningConfigured,
  verifyConfirmationToken,
} from "./subscribe-token";

// A static import is safe here because the module reads NEWSLETTER_SECRET
// inside signingKey() on every call rather than capturing it at import time.
// That is deliberate: a module-level read would bake in whatever the value was
// when the bundle first loaded, which on a serverless platform is not
// necessarily after the environment is populated.
process.env.NEWSLETTER_SECRET = "test-secret-key-at-least-16-chars";

test("a freshly minted token verifies to the address it was issued for", () => {
  const token = createConfirmationToken("reader@example.com");
  assert.ok(token);
  const result = verifyConfirmationToken(token);
  assert.deepEqual(result, { ok: true, email: "reader@example.com" });
});

test("signing is reported as configured when a long enough secret is set", () => {
  assert.equal(isTokenSigningConfigured(), true);
});

test("a tampered payload is rejected", () => {
  // The whole point: swap the address in the payload and the signature no
  // longer matches, so nobody can mint a confirmation for an inbox they do not
  // own by editing the link.
  const token = createConfirmationToken("reader@example.com")!;
  const [, signature] = token.split(".");
  const forged = Buffer.from(
    JSON.stringify({ v: "v1", e: "attacker@example.com", x: Date.now() + 1000 }),
  )
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  assert.deepEqual(verifyConfirmationToken(`${forged}.${signature}`), {
    ok: false,
    reason: "bad-signature",
  });
});

test("a token signed with another key is rejected", () => {
  const token = createConfirmationToken("reader@example.com")!;
  const [payload] = token.split(".");
  assert.deepEqual(verifyConfirmationToken(`${payload}.YWJjZGVm`), {
    ok: false,
    reason: "bad-signature",
  });
});

test("an expired token is rejected", () => {
  const issued = Date.now() - 3 * 24 * 60 * 60 * 1000;
  const token = createConfirmationToken("reader@example.com", issued)!;
  assert.deepEqual(verifyConfirmationToken(token), {
    ok: false,
    reason: "expired",
  });
});

test("a token still inside its window is accepted", () => {
  const issued = Date.now() - 47 * 60 * 60 * 1000;
  const token = createConfirmationToken("reader@example.com", issued)!;
  assert.deepEqual(verifyConfirmationToken(token), {
    ok: true,
    email: "reader@example.com",
  });
});

test("malformed tokens are rejected rather than throwing", () => {
  for (const bad of ["", ".", "nodot", "a.", ".b", "!!!.???"]) {
    const result = verifyConfirmationToken(bad);
    assert.equal(result.ok, false, `expected ${JSON.stringify(bad)} to fail`);
  }
});

test("tokens round-trip addresses containing plus tags and dots", () => {
  const email = "first.last+news@example.co.uk";
  const token = createConfirmationToken(email)!;
  assert.deepEqual(verifyConfirmationToken(token), { ok: true, email });
});
