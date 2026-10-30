// lib/subscribe-token.ts
// Signed tokens for the newsletter: the double opt-in confirmation link and the
// unsubscribe link in every digest. Server-only.
//
// Double opt-in normally needs a table of pending signups. This project has no
// datastore, so the pending record travels inside the link instead: the address
// and an expiry, signed with a secret only the server holds. Nothing is written
// anywhere until the reader clicks, and a link cannot be forged without the key.
//
// The trade is that a token cannot be revoked before it expires, which is why
// the window is two days rather than a fortnight — long enough to survive a
// weekend inbox, short enough that a leaked link stops working quickly.

import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_TTL_MS = 2 * 24 * 60 * 60 * 1000;
const VERSION = "v1";
const UNSUBSCRIBE_VERSION = "u1";

/**
 * The signing key.
 *
 * Required in production and deliberately not defaulted: a hard-coded fallback
 * would mean every deployment of this code shares a key, and anyone holding it
 * could mint a confirmation for an address they do not own — which is the exact
 * thing double opt-in exists to prevent. Without it the feature reports itself
 * unconfigured rather than running on a secret that is public.
 */
function signingKey(): string | null {
  const secret = process.env.NEWSLETTER_SECRET;
  if (secret && secret.length >= 16) return secret;
  return null;
}

export function isTokenSigningConfigured(): boolean {
  return signingKey() !== null;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64url(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function sign(payload: string, key: string): string {
  return base64url(createHmac("sha256", key).update(payload).digest());
}

/** A token for `email`, valid for TOKEN_TTL_MS. Null when no key is set. */
export function createConfirmationToken(
  email: string,
  now = Date.now(),
): string | null {
  const key = signingKey();
  if (!key) return null;

  const payload = base64url(
    JSON.stringify({ v: VERSION, e: email, x: now + TOKEN_TTL_MS }),
  );
  return `${payload}.${sign(payload, key)}`;
}

export type TokenFailure = "unconfigured" | "malformed" | "bad-signature" | "expired";

export type TokenResult =
  | { ok: true; email: string }
  | { ok: false; reason: TokenFailure };

interface TokenPayload {
  v?: string;
  e?: unknown;
  x?: unknown;
}

/**
 * Check the signature and parse the payload, and nothing else.
 *
 * The signature is checked before the payload is parsed and before anything in
 * it is read, so nothing an attacker controls is trusted until the HMAC says it
 * came from us. The comparison is constant-time: a byte-by-byte one leaks,
 * through timing, how much of a forged signature was correct, which is enough to
 * build a valid one a byte at a time.
 *
 * What the payload means — which kind of token it is, whether it has expired —
 * is the caller's to decide.
 */
function readSigned(
  token: string,
): { ok: true; payload: TokenPayload } | { ok: false; reason: TokenFailure } {
  const key = signingKey();
  if (!key) return { ok: false, reason: "unconfigured" };

  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) {
    return { ok: false, reason: "malformed" };
  }

  const payload = token.slice(0, dot);
  const provided = fromBase64url(token.slice(dot + 1));
  const expected = fromBase64url(sign(payload, key));

  // timingSafeEqual throws on a length mismatch, which is itself a fine answer.
  if (
    provided.length !== expected.length ||
    !timingSafeEqual(provided, expected)
  ) {
    return { ok: false, reason: "bad-signature" };
  }

  try {
    return {
      ok: true,
      payload: JSON.parse(fromBase64url(payload).toString("utf8")) as TokenPayload,
    };
  } catch {
    return { ok: false, reason: "malformed" };
  }
}

/** Verify a confirmation token and recover the address it was issued for. */
export function verifyConfirmationToken(
  token: string,
  now = Date.now(),
): TokenResult {
  const read = readSigned(token);
  if (!read.ok) return read;
  const parsed = read.payload;

  if (parsed.v !== VERSION || typeof parsed.e !== "string") {
    return { ok: false, reason: "malformed" };
  }
  if (typeof parsed.x !== "number" || !Number.isFinite(parsed.x)) {
    return { ok: false, reason: "malformed" };
  }
  if (now > parsed.x) return { ok: false, reason: "expired" };

  return { ok: true, email: parsed.e };
}

// ── Unsubscribe ─────────────────────────────────────────────────────────────

/**
 * A token for the unsubscribe link in a digest. Null when no key is set.
 *
 * It does not expire. A confirmation link is wanted for two days; an unsubscribe
 * link is wanted for as long as the email sits in somebody's inbox, which is
 * years, and one that stops working is a reader who cannot leave — the exact
 * failure the link exists to prevent.
 *
 * The version tag is inside the signed payload, so the two kinds of token are
 * not interchangeable: a confirmation link cannot be replayed here, and this one
 * cannot be replayed as a confirmation.
 */
export function createUnsubscribeToken(email: string): string | null {
  const key = signingKey();
  if (!key) return null;

  const payload = base64url(
    JSON.stringify({ v: UNSUBSCRIBE_VERSION, e: email }),
  );
  return `${payload}.${sign(payload, key)}`;
}

/** Verify an unsubscribe token and recover the address it was issued for. */
export function verifyUnsubscribeToken(token: string): TokenResult {
  const read = readSigned(token);
  if (!read.ok) return read;

  if (read.payload.v !== UNSUBSCRIBE_VERSION || typeof read.payload.e !== "string") {
    return { ok: false, reason: "malformed" };
  }
  return { ok: true, email: read.payload.e };
}
