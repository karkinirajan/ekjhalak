// netlify/functions/revalidate-feed.mts
// The daily cache-bust, as a Netlify scheduled function.
//
// This job was declared in vercel.json as a Vercel Cron. Production is Netlify,
// which does not read vercel.json, so it has never run — the feed has been
// relying entirely on the 5-minute ISR window since launch. That mostly works;
// what it cannot do is recover a cache poisoned by a bad aggregation, or force a
// pass once a day when the enrichment quota has reset.
//
// The schedule stays in this file rather than in netlify.toml on purpose. The
// site's build settings live in the Netlify UI and there is no netlify.toml in
// the repo; adding one would silently take over build command and publish
// directory as well, which is a much bigger change than scheduling a cron.
// Functions API v2 lets a function declare its own schedule, so it does.

/**
 * Runs at 00:00 UTC — 05:45 in Kathmandu, which is the point of the day this is
 * actually for. Nepali newsrooms file the overnight stories in the small hours,
 * and a purge just before the country wakes up means the first reader of the
 * morning gets a feed built from them rather than from yesterday evening.
 */
export const config = {
  schedule: "0 0 * * *",
};

/**
 * Calls the app's own revalidate route rather than importing `revalidateTag`.
 *
 * A Netlify scheduled function is a separate bundle from the Next.js server, so
 * it has no access to Next's cache API — importing it would either fail to
 * resolve or, worse, resolve to a second copy of Next holding a different cache.
 * One HTTP call to the route that already exists keeps a single implementation
 * of "purge the feed" and exercises the same path an operator would use by hand.
 */
export default async function handler(): Promise<Response> {
  const base = (process.env.URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "")
    .replace(/\/$/, "");

  if (!base) {
    console.error("[cron] no site URL in the environment; nothing to call");
    return new Response("missing site url", { status: 500 });
  }

  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    // The route fails closed in production, so without this the job would run
    // every night and collect a 401 every night. Saying so once here is more
    // use than a silent unauthorized in the function log.
    console.error(
      "[cron] REVALIDATE_SECRET is not set — /api/revalidate will reject this",
    );
  }

  const target = `${base}/api/revalidate${secret ? `?secret=${encodeURIComponent(secret)}` : ""}`;

  try {
    const res = await fetch(target, {
      method: "POST",
      // The route is the only thing that should ever answer this, and a
      // redirect to somewhere else carrying the secret in its query string is
      // not something to follow.
      redirect: "manual",
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      console.error(`[cron] revalidate failed: HTTP ${res.status}`);
      return new Response(`revalidate failed: ${res.status}`, { status: 502 });
    }

    console.log("[cron] news-feed cache purged");
    return new Response("ok");
  } catch (err) {
    console.error("[cron] revalidate request failed:", err);
    return new Response("request failed", { status: 502 });
  }
}
