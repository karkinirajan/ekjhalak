// lib/fetch-deadline.ts
// A fetch that is actually bounded by its budget.
//
// Split out of lib/rss-adapter.ts, which is `server-only` and so cannot be
// imported by this project's plain-Node test runner — the same seam
// lib/article-parse.ts was split along, and for the same reason: the part worth
// testing here is the timeout, and the timeout is exactly the part that failed
// silently in production.
//
// The failure it exists to prevent: the RSS stage awaits 23 sources together,
// each handed a 7.5s budget through an AbortSignal, so it cannot honestly
// exceed about 8s. It was measuring 25s, and 34s once a caching layer was
// removed. Locally the same 23 feeds with the same abort finish in 2.1s, the
// XML parse for all of them totals 53ms, and deduplicating 450 stories is
// 131ms — none of the work accounts for the wall clock. What was left was the
// signal: on Vercel `fetch` is Next.js's patched version, and the abort was not
// arriving. A budget enforced only by something the runtime may reshape is not
// a budget.

/**
 * Fetch a URL and read its body, guaranteed to settle within `budgetMs`.
 *
 * The AbortController is still created and still fired, because when the signal
 * *is* honoured it closes the socket rather than leaving it dangling. It is
 * simply no longer the only thing enforcing the deadline: `Promise.race`
 * bounds the whole read — connect, headers and body — on the runtime's own
 * timer, which no wrapper around `fetch` can drop.
 *
 * The race is given a small grace over the abort so that a signal that does
 * work wins it, and the caller sees the real failure rather than this generic
 * one.
 */
export async function readWithDeadline(
  url: string,
  budgetMs: number,
  init: Omit<RequestInit, "signal"> = {},
  grace = 250,
): Promise<string> {
  const controller = new AbortController();
  const abortAt = setTimeout(() => controller.abort(), budgetMs);
  let expireAt: ReturnType<typeof setTimeout> | undefined;

  try {
    const read = (async () => {
      const response = await fetch(url, { ...init, signal: controller.signal });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }
      return response.text();
    })();

    const expire = new Promise<never>((_, reject) => {
      expireAt = setTimeout(
        () => reject(new Error(`Timed out after ${budgetMs}ms for ${url}`)),
        budgetMs + grace,
      );
    });

    return await Promise.race([read, expire]);
  } finally {
    clearTimeout(abortAt);
    if (expireAt) clearTimeout(expireAt);
  }
}
