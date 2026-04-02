// lib/security/rate-limit.ts
// Simple sliding-window rate limiter backed by an in-process LRU cache.
//
// Note on Vercel scale-out: because each serverless instance has independent
// memory, limits are per-instance. This is adequate as a DoS deterrent; for
// strict distributed rate limiting you would swap the store for Upstash Redis
// or a Supabase table. The interface here makes that swap straightforward.

interface Entry {
  count: number;
  resetAt: number;
}

// Maximum number of IP addresses to track simultaneously
const MAX_ENTRIES = 2_000;

class RateLimitStore {
  private map = new Map<string, Entry>();

  private evict() {
    if (this.map.size < MAX_ENTRIES) return;
    // Evict the oldest entry
    const first = this.map.keys().next().value;
    if (first !== undefined) this.map.delete(first);
  }

  check(
    key: string,
    limit: number,
    windowMs: number,
  ): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    let entry = this.map.get(key);

    if (!entry || entry.resetAt <= now) {
      this.evict();
      entry = { count: 0, resetAt: now + windowMs };
      this.map.set(key, entry);
    }

    entry.count++;

    return {
      allowed: entry.count <= limit,
      remaining: Math.max(0, limit - entry.count),
      resetAt: entry.resetAt,
    };
  }
}

// Singleton store — shared within the process
const store = new RateLimitStore();

export interface RateLimitConfig {
  /** Max requests allowed per window */
  limit: number;
  /** Window size in milliseconds */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Unix ms when the window resets */
  resetAt: number;
}

/**
 * Check and increment the rate limit for a given identifier.
 *
 * @param identifier — typically the client IP address (from x-forwarded-for)
 * @param config     — limit and window for this endpoint
 */
export function rateLimit(
  identifier: string,
  config: RateLimitConfig,
): RateLimitResult {
  return store.check(identifier, config.limit, config.windowMs);
}

/**
 * Extract the best available IP from Next.js request headers.
 * Falls back to "unknown" if no IP can be determined.
 */
export function getClientIp(headers: Headers): string {
  return (
    headers.get("x-real-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

/**
 * Standard rate-limit response headers.
 */
export function rateLimitHeaders(
  result: RateLimitResult,
): Record<string, string> {
  return {
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  };
}

// ── Pre-configured limiters ───────────────────────────────────────────────────

/** Subscribe endpoint: 5 requests / 10 minutes per IP */
export const SUBSCRIBE_LIMIT: RateLimitConfig = {
  limit: 5,
  windowMs: 10 * 60 * 1_000,
};

/** Admin endpoints: 20 requests / minute per IP (should be HMAC-gated already) */
export const ADMIN_LIMIT: RateLimitConfig = {
  limit: 20,
  windowMs: 60 * 1_000,
};
