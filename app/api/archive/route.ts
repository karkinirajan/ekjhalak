import { NextRequest, NextResponse } from "next/server";

import { archiveStatus, countArticles } from "@/lib/article-store";

/**
 * Is the archive actually working?
 *
 * This route exists because the honest answer used to be "nobody can tell".
 * `lib/article-store.ts` swallows every failure by design — the feed must work
 * without a database, so an unreachable one is a warning and nothing else — and
 * the cost of that design was paid in full: the archive was misconfigured for
 * its entire existence and wrote zero rows, while `/api/news` returned 200
 * throughout and every dashboard looked healthy. A warning in a serverless log
 * nobody tails is indistinguishable from silence.
 *
 * Two numbers are reported, and the difference between them is the point.
 * `status` is what this instance remembers doing — per-process, reset by every
 * cold start, useless as a total and exactly right for "did the last write on
 * this instance succeed, and if not what did PostgREST say". `rows` is a live
 * count from the database, which is the only figure a healthy-looking log
 * cannot fake.
 *
 * Authenticated with the same secret as the revalidate route and failing closed
 * the same way. Nothing here is a credential, but row counts and error strings
 * are operational detail, and an endpoint that names the database technology and
 * quotes its errors is a free reconnaissance step for anyone poking at the site.
 */

// Never prerendered: this must read the database at request time, not at build.
export const dynamic = "force-dynamic";

function isAuthorized(presented: string | null): boolean {
  const expected = process.env.REVALIDATE_SECRET;
  if (expected) return presented === expected;

  // No secret configured: allowed only outside production, where there is
  // nothing to protect and requiring one would make local work tedious. The
  // same rule as /api/revalidate, and for the same reason — a forgotten
  // environment variable must not silently publish the endpoint.
  return process.env.NODE_ENV !== "production";
}

export async function GET(request: NextRequest) {
  const secret =
    request.nextUrl.searchParams.get("secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    null;

  if (!isAuthorized(secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = archiveStatus();
  const rows = status.configured ? await countArticles() : null;

  // `configured` false, or a live count that will not come back, is a failure of
  // this endpoint's subject rather than of the endpoint. 200 with `ok: false`
  // says "I answered, and the answer is bad" — a 5xx here would be indistinguish-
  // able from the route itself being broken, which is the one thing a health
  // check must never be ambiguous about.
  const ok = status.configured && rows !== null;

  return NextResponse.json(
    {
      ok,
      rows,
      ...status,
      hint: !status.configured
        ? "Set SUPABASE_URL (the https://<ref>.supabase.co REST origin) and SUPABASE_SERVICE_ROLE_KEY."
        : rows === null
          ? "Configured, but the row count could not be read — see lastError."
          : undefined,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
