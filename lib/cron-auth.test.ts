import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";

import { bearerToken, isCronAuthorized } from "./cron-auth";

// NODE_ENV is typed read-only by Next's own declarations; this suite has to set it.
const env = process.env as Record<string, string | undefined>;
const KEYS = ["CRON_SECRET", "REVALIDATE_SECRET", "NODE_ENV"] as const;
let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((k) => [k, env[k]]));
  for (const k of KEYS) delete env[k];
});

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete env[k];
    else env[k] = saved[k];
  }
});

test("a scheduler's GET needs the CRON_SECRET bearer token", () => {
  env.CRON_SECRET = "cron-secret-value";
  env.NODE_ENV = "production";
  assert.equal(isCronAuthorized("GET", "cron-secret-value"), true);
  assert.equal(isCronAuthorized("GET", "wrong"), false);
  assert.equal(isCronAuthorized("GET", null), false);
  assert.equal(isCronAuthorized("GET", ""), false);
});

test("a POST needs REVALIDATE_SECRET, and the GET secret does not open it", () => {
  env.CRON_SECRET = "cron-secret-value";
  env.REVALIDATE_SECRET = "revalidate-secret-value";
  env.NODE_ENV = "production";
  assert.equal(isCronAuthorized("POST", "revalidate-secret-value"), true);
  assert.equal(isCronAuthorized("POST", "cron-secret-value"), false);
  assert.equal(isCronAuthorized("GET", "revalidate-secret-value"), false);
});

test("production with no secret configured fails closed", () => {
  env.NODE_ENV = "production";
  assert.equal(isCronAuthorized("GET", null), false);
  assert.equal(isCronAuthorized("GET", "anything"), false);
  assert.equal(isCronAuthorized("POST", "anything"), false);
});

test("outside production, no secret means open — local work stays easy", () => {
  env.NODE_ENV = "development";
  assert.equal(isCronAuthorized("GET", null), true);
  assert.equal(isCronAuthorized("POST", null), true);
});

test("a configured secret is enforced even outside production", () => {
  env.NODE_ENV = "development";
  env.CRON_SECRET = "cron-secret-value";
  assert.equal(isCronAuthorized("GET", null), false);
  assert.equal(isCronAuthorized("GET", "cron-secret-value"), true);
});

test("bearerToken strips the scheme, case-insensitively, and tolerates absence", () => {
  assert.equal(bearerToken(new Headers({ authorization: "Bearer abc" })), "abc");
  assert.equal(bearerToken(new Headers({ authorization: "bearer abc" })), "abc");
  assert.equal(bearerToken(new Headers()), null);
});
