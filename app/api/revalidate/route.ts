import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { secretsMatch } from "@/lib/secret-compare";

/**
 * On-demand cache invalidation for the news feed.
 *
 * Two callers, two credentials:
 *
 *   GET   Vercel Cron. The platform sends `Authorization: Bearer $CRON_SECRET`
 *         on every scheduled invocation, and it only ever issues GET — so a
 *         POST-only route could not have served the schedule even if the
 *         schedule had pointed here. It pointed at `/api/cron/enrich`, a route
 *         that has never existed in this repo, and 404'd daily.
 *
 *   POST  Anything else trusted, authenticated with `?secret=`.
 *
 * Both fail closed. The previous implementation skipped the check entirely when
 * REVALIDATE_SECRET was unset — "allow freely (dev/staging)" — which meant a
 * forgotten environment variable did not break the deploy, it published an
 * unauthenticated cache-purge endpoint. A missing secret in production is now a
 * 401; only an explicitly non-production NODE_ENV opens the door.
 */

function isAuthorized(method: "GET" | "POST", presented: string | null) {
  const expected =
    method === "GET" ? process.env.CRON_SECRET : process.env.REVALIDATE_SECRET;

  if (expected) return secretsMatch(presented, expected);

  // No secret configured: allowed only outside production, where there is
  // nothing to protect and requiring one would make local work tedious.
  return process.env.NODE_ENV !== "production";
}

function purge() {
  revalidateTag("news-feed", "max");
  return NextResponse.json({
    revalidated: true,
    tag: "news-feed",
    timestamp: new Date().toISOString(),
  });
}

export async function GET(request: NextRequest) {
  const bearer =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!isAuthorized("GET", bearer)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return purge();
}

export async function POST(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");
  if (!isAuthorized("POST", secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return purge();
}
