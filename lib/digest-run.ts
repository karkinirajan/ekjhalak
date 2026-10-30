// lib/digest-run.ts
// One run of the daily digest. Server-only.
//
// Called by /api/cron/digest, which a scheduler fires several times across the
// send window. That is deliberate and safe: every run starts by claiming the
// recipients who have not had today's digest (lib/digest-store.ts), so a second
// run finds nothing to do and a run that was cut short is finished by the next.

import "server-only";

import { createHash } from "node:crypto";

import { isDbConfigured } from "./db";
import {
  countStories,
  DIGEST_WINDOW_HOURS,
  digestDate,
  pickStories,
  renderDigest,
  subscriberLang,
  unsubscribeHeaders,
  type DigestStories,
} from "./digest";
import {
  claimRecipients,
  fetchRecentStories,
  markDelivery,
  type Recipient,
} from "./digest-store";
import { envInt } from "./env";
import {
  canSendMail,
  MAX_BATCH,
  sendDigestBatch,
  sendDigestMessage,
  type DigestMessage,
} from "./newsletter";
import { applyPublishGate } from "./publish-gate";
import { SITE_URL, siteUrl, storyUrl } from "./site-url";
import { createUnsubscribeToken, isTokenSigningConfigured } from "./subscribe-token";
import { countConfirmed } from "./subscribers";

/**
 * Pause between requests to the mail provider.
 *
 * Resend throttles per second, and a 429 mid-run would stop it. Sleeping between
 * requests costs seconds on a list that takes a handful of requests, and avoids
 * the throttle instead of recovering from it.
 */
const PAUSE_MS = 600;

/** Stories read from the archive before the gate and the cut. Headroom for the gate. */
const CANDIDATE_LIMIT = 300;

export interface DigestSummary {
  status: "sent" | "partial" | "dry-run" | "skipped" | "failed";
  date: string;
  reason?: string;
  stories?: number;
  /** Dry runs only: how many confirmed subscribers a real run would address. */
  recipients?: number | null;
  claimed?: number;
  sent?: number;
  failed?: number;
  /** True when the run stopped on time or a throttle with people still to mail. */
  moreRemaining?: boolean;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function messageFor(
  recipient: Recipient,
  stories: DigestStories,
  now: Date,
): DigestMessage {
  const token = createUnsubscribeToken(recipient.email);
  if (!token) throw new Error("unsubscribe token unavailable");

  const lang = subscriberLang(recipient.language);
  const encoded = encodeURIComponent(token);
  const rendered = renderDigest(stories, {
    lang,
    now,
    unsubscribeUrl: siteUrl(`/unsubscribe?token=${encoded}&lang=${lang}`),
    storyUrl,
    siteUrl: SITE_URL,
  });

  return {
    to: recipient.email,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    headers: unsubscribeHeaders(siteUrl(`/api/unsubscribe?token=${encoded}`)),
  };
}

/**
 * Write a delivery result, and never let a failure to write it undo the run.
 *
 * By the time this is called the mail has already gone, so there is nothing to
 * roll back. If the ledger cannot be written the rows stay 'sending' and the
 * next run reclaims them after the claim expires — which can mean a second copy,
 * so it is logged loudly instead of swallowed.
 */
async function record(
  date: string,
  ids: string[],
  status: "sent" | "failed",
  error?: string,
): Promise<void> {
  try {
    await markDelivery(date, ids, status, error);
  } catch (err) {
    console.error(
      `[digest] ${ids.length} sends NOT RECORDED as ${status} for ${date} — ` +
        `they may be sent again once their claim expires:`,
      err instanceof Error ? err.message : err,
    );
  }
}

interface BatchOutcome {
  sent: number;
  failed: number;
  /** Stop the run: the provider is throttling or down, or time is up. */
  halt: boolean;
}

async function deliver(
  batch: Recipient[],
  stories: DigestStories,
  now: Date,
  date: string,
  deadline: number,
): Promise<BatchOutcome> {
  // Each message stays paired with its recipient, so the fallback below can
  // address one without indexing back into a parallel array.
  const prepared = batch.map((recipient) => ({
    recipient,
    message: messageFor(recipient, stories, now),
  }));
  const messages = prepared.map((p) => p.message);
  const ids = batch.map((r) => r.id);
  const key = `digest-${date}-${createHash("sha256").update(ids.join(",")).digest("hex").slice(0, 16)}`;

  const result = await sendDigestBatch(messages, key);
  if (result.ok) {
    await record(date, ids, "sent");
    return { sent: batch.length, failed: 0, halt: false };
  }

  // Throttled or down: nothing in this batch is known to be bad, so give all of
  // it back for the next run rather than singling anyone out.
  if (result.retryable) {
    await record(date, ids, "failed", `batch ${result.status ?? "network"}`);
    return { sent: 0, failed: batch.length, halt: true };
  }

  // The batch was rejected, which means at least one message in it is. Resend
  // refuses the whole request over one bad address, so send them one at a time
  // to find which — otherwise a single typo in the list would stop the digest
  // for the ninety-nine around it.
  let sent = 0;
  let failed = 0;
  for (const [index, { recipient, message }] of prepared.entries()) {
    if (Date.now() > deadline) {
      const rest = batch.slice(index).map((r) => r.id);
      await record(date, rest, "failed", "deferred: out of time");
      return { sent, failed: failed + rest.length, halt: true };
    }

    await sleep(PAUSE_MS);
    const one = await sendDigestMessage(message, `${key}-${recipient.id}`);
    if (one.ok) {
      await record(date, [recipient.id], "sent");
      sent += 1;
      continue;
    }

    await record(date, [recipient.id], "failed", `http ${one.status ?? "network"}`);
    failed += 1;

    if (one.retryable) {
      const rest = batch.slice(index + 1).map((r) => r.id);
      await record(date, rest, "failed", "deferred: provider unavailable");
      return { sent, failed: failed + rest.length, halt: true };
    }
  }
  return { sent, failed, halt: false };
}

export async function runDigest(
  options: { dry?: boolean; now?: Date } = {},
): Promise<DigestSummary> {
  const now = options.now ?? new Date();
  const date = digestDate(now);
  const skipped = (reason: string, stories?: number): DigestSummary => ({
    status: "skipped",
    date,
    reason,
    stories,
  });

  // The three things a digest cannot be sent without. Checked up front so a
  // misconfigured deploy fails visibly once, instead of claiming recipients it
  // then cannot mail.
  if (!isDbConfigured()) return skipped("no-database");
  if (!canSendMail()) return skipped("no-mail-transport");
  if (!isTokenSigningConfigured()) return skipped("no-signing-key");

  const startedAt = Date.now();
  const deadline = startedAt + envInt("DIGEST_BUDGET_MS", 25_000, 1_000);
  const maxStories = envInt("DIGEST_MAX_STORIES", 25, 1);

  let stories: DigestStories;
  try {
    const candidates = await fetchRecentStories(DIGEST_WINDOW_HOURS, CANDIDATE_LIMIT);
    const gate = applyPublishGate(candidates);
    stories = pickStories(gate.published, maxStories);
    console.log(
      `[digest] ${date}: ${candidates.length} stories in ${DIGEST_WINDOW_HOURS}h, ` +
        `${gate.withheld} withheld by the ${gate.policy} gate, ${countStories(stories)} picked`,
    );
  } catch (err) {
    console.error("[digest] could not read stories:", err instanceof Error ? err.message : err);
    return { status: "failed", date, reason: "story-read-failed" };
  }

  const total = countStories(stories);
  if (total === 0) return skipped("no-stories", 0);

  if (options.dry) {
    return { status: "dry-run", date, stories: total, recipients: await countConfirmed() };
  }

  let claimed = 0;
  let sent = 0;
  let failed = 0;
  let moreRemaining = false;
  // Everyone this run has claimed, so a failure is left for the next trigger
  // instead of being retried here until the clock runs out.
  const seen: string[] = [];

  try {
    for (;;) {
      if (Date.now() > deadline) {
        moreRemaining = true;
        break;
      }

      const batch = await claimRecipients(date, MAX_BATCH, seen);
      if (batch.length === 0) break;
      claimed += batch.length;
      seen.push(...batch.map((r) => r.id));

      const outcome = await deliver(batch, stories, now, date, deadline);
      sent += outcome.sent;
      failed += outcome.failed;
      if (outcome.halt) {
        moreRemaining = true;
        break;
      }
      await sleep(PAUSE_MS);
    }
  } catch (err) {
    console.error("[digest] run aborted:", err instanceof Error ? err.message : err);
    return { status: "failed", date, reason: "run-aborted", stories: total, claimed, sent, failed };
  }

  console.log(
    `[digest] ${date}: claimed ${claimed}, sent ${sent}, failed ${failed}` +
      `${moreRemaining ? ", more remaining" : ""}`,
  );

  // Nothing claimed and nothing left over means an earlier run already finished
  // this morning's digest — the normal outcome of the second and third trigger.
  if (claimed === 0 && !moreRemaining) return skipped("nothing-to-send", total);

  return {
    status: failed === 0 && !moreRemaining ? "sent" : "partial",
    date,
    stories: total,
    claimed,
    sent,
    failed,
    moreRemaining,
  };
}
