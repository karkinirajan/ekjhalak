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
 *   GET   a scheduler, authenticated with `Authorization: Bearer $CRON_SECRET`.
 *   POST  anything else trusted, authenticated with `?secret=` — see
 *         lib/cron-auth.ts.
 *
 * Add `?dry=1` to either to see what a run *would* do — how many stories it
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

export async function POST(request: NextRequest) {
  if (!isCronAuthorized("POST", request.nextUrl.searchParams.get("secret"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return respond(await runDigest({ dry: request.nextUrl.searchParams.get("dry") === "1" }));
}
