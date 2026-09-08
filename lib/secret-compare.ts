import { timingSafeEqual } from "node:crypto";

/**
 * Compare a presented secret against the expected one in constant time.
 *
 * `presented === expected` is the obvious version and the wrong one: string
 * comparison returns as soon as two bytes differ, so how long the check takes
 * is a function of how many leading bytes were correct. That is enough to
 * recover a secret a byte at a time, and the endpoints this guards —
 * cache purge and a database-status readout — are exactly the kind an attacker
 * can call repeatedly without anyone noticing.
 *
 * `lib/subscribe-token.ts` already did this correctly for the subscriber HMAC;
 * the admin secrets on /api/revalidate and /api/archive were still using `===`.
 *
 * Deliberately not `server-only`, unlike its callers. This is pure logic — it
 * holds no secret and does no I/O — and lib/article-parse.ts documents the
 * convention this follows: a `server-only` module cannot be imported by this
 * project's plain-Node test runner, so the pure part is split out and tested.
 * The routes that call it are server-side by construction.
 *
 * Buffers are compared at equal length because `timingSafeEqual` throws on a
 * length mismatch. Hashing both sides to a fixed width would hide the length,
 * but the length of a configured secret is not the part worth protecting and
 * the extra step is one more thing to get wrong — so length is checked first
 * and only equal-length candidates reach the constant-time path.
 */
export function secretsMatch(
  presented: string | null,
  expected: string,
): boolean {
  if (!presented) return false;

  const a = Buffer.from(presented, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}
