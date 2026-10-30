import { NextRequest, NextResponse } from "next/server";
import { bearerToken, isCronAuthorized } from "@/lib/cron-auth";
import { runDigest, type DigestSummary } from "@/lib/digest-run";

/**
 * The daily digest: the last 24 hours of stories, mailed to every confirmed
 * subscriber.
 *
 * Fired by a scheduler, several times across the morning send window. Safe by
 * construction — each run claims only the subscribers who have not yet had
 * today's digest, so the second and third trigger find nothing to do unless an
 * earlier one was cut short. See lib/digest-store.ts.
 *
 * GET only, authenticated with `Authorization: Bearer $CRON_SECRET` — the
 * scheduler's credential, and the one a person with curl uses to trigger it by
 * hand. There is deliberately no POST: /api/revalidate's POST takes
 * REVALIDATE_SECRET, which is for purging a cache, and letting that secret also
 * send email to every subscriber would make a low-stakes credential a high-stakes
 * one. Nor is the secret accepted in the query string — a URL is written to
 * access and proxy logs, so a secret in one is a secret in every log that sees
 * the request. Both are things /api/revalidate does for the callers it already
 * has; this route is new and has none.
 *
 * Add `?dry=1` to see what a run *would* do — how many stories it
 * picked and how many subscribers it would address — without claiming or
 * sending anything. That is the safe way to check a deploy.
 */

/**
 * Skips that are the system working, not failing: a quiet day, or an earlier
 * trigger already finished the job. Every other skip is a misconfiguration, and
 * answers 503 so it shows red in the scheduler's log instead of green.
 */
const BENIGN_SKIPS = new Set(["no-stories", "nothing-to-send"]);

function respond(summary: DigestSummary) {
  const status =
    summary.status === "failed"
      ? 500
      : summary.status === "skipped" && !BENIGN_SKIPS.has(summary.reason ?? "")
        ? 503
        : 200;
  return NextResponse.json(summary, { status });
}

export async function GET(request: NextRequest) {
  if (!isCronAuthorized("GET", bearerToken(request.headers))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return respond(await runDigest({ dry: request.nextUrl.searchParams.get("dry") === "1" }));
}
