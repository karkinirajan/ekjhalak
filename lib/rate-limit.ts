// lib/rate-limit.ts
// A fixed-window limiter held in process memory. Server-only.
//
// Honest about what it is: per-instance, so a deployment running several
// function instances allows the limit per instance rather than globally, and a
// cold start forgets everything. That makes it useless against a distributed
// attacker and perfectly adequate against the thing it actually guards — one
// script hammering the signup form from one address.
//
// The alternative is a shared store, which means provisioning Redis for a form
// that takes an email address. If abuse ever justifies that, this module is the
// single place it would change.

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();
const MAX_KEYS = 10_000;

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the window resets — becomes the Retry-After header. */
  retryAfter: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): RateLimitResult {
  const existing = windows.get(key);

  if (!existing || now >= existing.resetAt) {
    // Bound the map before inserting. Without this an attacker rotating IPs
    // turns the limiter itself into the memory leak it was added to prevent.
    if (windows.size >= MAX_KEYS) {
      for (const [candidate, window] of windows) {
        if (now >= window.resetAt) windows.delete(candidate);
      }
      if (windows.size >= MAX_KEYS) {
        const oldest = windows.keys().next();
        if (!oldest.done) windows.delete(oldest.value);
      }
    }
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }

  existing.count += 1;
  if (existing.count > limit) {
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }
  return { allowed: true, retryAfter: 0 };
}

/**
 * The client's address, as far as it can be known.
 *
 * On Vercel `x-forwarded-for` is set by the platform and its first entry is the
 * real client. Off Vercel it is a client-supplied header and trivially spoofed —
 * which is a limitation of the limiter, not a hole to plug here, since a limiter
 * this shape cannot be authoritative anyway.
 */
export function clientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}
