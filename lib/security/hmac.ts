// lib/security/hmac.ts
// HMAC-SHA256 signature generation and verification for admin endpoints.
// Server-only.

import { createHmac, timingSafeEqual } from "node:crypto";

const SECRET = process.env.INGEST_HMAC_SECRET ?? "";

/**
 * Create an HMAC-SHA256 hex signature for a given message.
 * The message should be the raw request body (string) or a deterministic
 * serialization of the request payload.
 */
export function signHmac(message: string, secret = SECRET): string {
  if (!secret) throw new Error("INGEST_HMAC_SECRET is not set");
  return createHmac("sha256", secret).update(message).digest("hex");
}

/**
 * Constant-time comparison of two HMAC signatures.
 * Returns true if the signatures match.
 */
export function verifyHmac(
  message: string,
  providedSignature: string,
  secret = SECRET,
): boolean {
  if (!secret) return false;
  if (!providedSignature) return false;

  try {
    const expected = signHmac(message, secret);
    // Convert both to Buffers for timingSafeEqual (must be same length)
    const expectedBuf = Buffer.from(expected, "hex");
    const providedBuf = Buffer.from(providedSignature.toLowerCase(), "hex");

    // Reject if lengths differ (prevents timing oracle on malformed signatures)
    if (expectedBuf.length !== providedBuf.length) return false;

    return timingSafeEqual(expectedBuf, providedBuf);
  } catch {
    return false;
  }
}

/**
 * Extract HMAC signature from request headers.
 * Looks for: x-ingest-hmac, x-hub-signature-256, authorization Bearer prefix.
 */
export function extractSignatureFromRequest(headers: Headers): string | null {
  return (
    headers.get("x-ingest-hmac") ??
    headers.get("x-hub-signature-256")?.replace(/^sha256=/, "") ??
    null
  );
}
