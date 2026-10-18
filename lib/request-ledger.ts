// lib/request-ledger.ts
//
// What OpenRouter's free tier has been asked for today, and what it may still
// be asked for.
//
// A second ledger rather than a field on the first, because the two providers
// meter different things and conflating them would break both.
//
// Groq meters TOKENS, per organization per model, 200,000 a day. That is what
// lib/token-ledger.ts counts, and its unit is the reason `BATCH_SIZE` is 3:
// Groq's tighter limit is 8,000 tokens a MINUTE, so a batch is sized to fit
// inside a minute's window.
//
// OpenRouter's free tier meters REQUESTS, and — this is the part that inverts
// the design — it appears to do so per ACCOUNT across every `:free` model
// rather than per model. So:
//
//   - Tokens are not the constraint. The free models carry 256k–1M context,
//     so a batch of twenty costs one request exactly like a batch of three.
//     Bigger batches are strictly cheaper here, which is the opposite of Groq.
//
//   - Splitting the two jobs across two models buys nothing. On Groq that is
//     what buys capacity — summarizing on gpt-oss-120b and translating on
//     qwen3.8-27b draw from separate pots. Here they draw from the same pot,
//     so this ledger is deliberately NOT keyed by `ModelPurpose`. A per-purpose
//     counter would believe it had twice the allowance it has, and the day
//     would end in 429s with the ledger still reporting room.
//
// Per process, like the token ledger and the rate limiter, and honest about it:
// several warm instances each keep their own count, so real usage can be a
// multiple of this. It is a brake on the common case, not an accounting system;
// `syncRequestLedgerFrom429` is what corrects it against OpenRouter's own
// refusal when the real limit is hit.

import { envInt } from "./env";

/**
 * Requests a day this pipeline is willing to spend on OpenRouter's free tier.
 *
 * 50 is the documented free-tier allowance for an account that has bought less
 * than $10 of credits over its lifetime. Buying $10 once raises it to 1,000 —
 * and the entitlement survives spending every cent of those credits, so it is a
 * one-off purchase rather than a subscription. Set this to 1000 after that.
 *
 * Sized against this feed: about 161 new stories a day, needing a summary call
 * and a translation call for each batch. At `GROQ_BATCH_SIZE=3` that is ~108
 * requests and does not fit in 50. At 20 it is ~18 requests and fits with room
 * to spare, which is why raising the batch size is the first thing to do when
 * OpenRouter leads the chain.
 *
 * Setting it to 0 disables the ledger and restores spend-until-refused.
 */
export const DAILY_REQUEST_BUDGET = envInt(
  "OPENROUTER_DAILY_REQUEST_BUDGET",
  50,
  0,
);

/**
 * Requests a minute, which is a separate cap from the daily one.
 *
 * 20 for the free tier regardless of credit balance. It is not the binding
 * constraint at this feed's volume — about 18 requests a day at
 * `GROQ_BATCH_SIZE=20` — but it becomes one the moment the daily budget is
 * raised to 1,000 and the batch size is left at 3: a pass would then fire ~108
 * requests three at a time, which can clear 20 in a minute easily.
 *
 * Worth guarding rather than absorbing, because a per-minute refusal may still
 * count against the DAILY cap. That makes hitting this limit strictly worse
 * than waiting for it — the same asymmetry that makes lib/summarizer.ts wait
 * out Groq's token window instead of spending a request to be refused.
 */
export const MINUTE_REQUEST_LIMIT = envInt(
  "OPENROUTER_MINUTE_REQUEST_LIMIT",
  20,
  0,
);

interface Ledger {
  day: string;
  used: number;
}

/** Timestamps of recent requests, newest last, pruned to the last minute. */
const recent: number[] = [];

function pruneRecent(now: number) {
  while (recent.length > 0 && now - (recent[0] ?? 0) >= 60_000) recent.shift();
}

/**
 * How long to wait before the next request fits inside the per-minute cap.
 *
 * Zero when there is room now. Callers treat a non-zero result the way
 * lib/summarizer.ts treats Groq's token window: wait if the pass can still
 * afford to, otherwise move on to the next model in the chain.
 */
export function msUntilRequestSlot(): number {
  if (MINUTE_REQUEST_LIMIT === 0) return 0;
  const now = Date.now();
  pruneRecent(now);
  if (recent.length < MINUTE_REQUEST_LIMIT) return 0;
  const oldest = recent[0] ?? now;
  return Math.max(0, 60_000 - (now - oldest));
}

const ledger: Ledger = { day: "", used: 0 };

/**
 * UTC, which is when OpenRouter's daily window is understood to reset.
 *
 * Matching lib/token-ledger.ts deliberately: if the two ledgers rolled over at
 * different moments there would be an hour each day where one believes it is
 * tomorrow and the other does not, and the pipeline's behaviour in that hour
 * would depend on which gate was asked first.
 */
function utcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

function current(): Ledger {
  const day = utcDay();
  if (day !== ledger.day) {
    ledger.day = day;
    ledger.used = 0;
  }
  return ledger;
}

/** Requests left in today's allowance. */
export function requestsRemaining(): number {
  if (DAILY_REQUEST_BUDGET === 0) return Number.POSITIVE_INFINITY;
  return Math.max(0, DAILY_REQUEST_BUDGET - current().used);
}

/** What the ledger believes has been spent today. */
export function requestsUsedToday(): number {
  return current().used;
}

/**
 * Count one request against today's allowance.
 *
 * Called for every attempt that reaches OpenRouter, including the ones that
 * fail. OpenRouter's own pricing page states that failed requests may still
 * count toward the cap, so counting only successes would let a model that 500s
 * in a loop burn the real allowance while this ledger reported it untouched —
 * the same class of silent overdraw the token ledger was written to stop.
 */
export function recordRequestSpend(count = 1) {
  current().used += count;
  const now = Date.now();
  pruneRecent(now);
  for (let i = 0; i < count; i++) recent.push(now);
}

/**
 * Believe OpenRouter over the local count.
 *
 * Its daily refusal carries the authoritative figure, and is also the only way
 * a cold instance learns the day is already spent. Two shapes are accepted
 * because the message has been seen both ways:
 *
 *     "...limit of 50 requests per day..."
 *     "...rate-limited: 50 per day..."
 *
 * Only ever raises the count, never lowers it: with several instances each
 * counting their own spend, the lower figure is the one that is wrong, and
 * letting a refusal talk the ledger back down would reopen a budget that is
 * actually closed.
 */
export function syncRequestLedgerFrom429(body: string): void {
  const match = body.match(/(\d+)\s*(?:free[- ]model\s*)?(?:requests?\s*)?per[- ]day/i);
  if (!match) return;
  const limit = Number.parseInt(match[1] ?? "", 10);
  if (!Number.isFinite(limit)) return;
  // The refusal proves the whole allowance is gone, whatever this process
  // counted. It reports the limit, not the usage, so the limit IS the usage.
  const l = current();
  l.used = Math.max(l.used, limit);
}

/** Test seam: forget today's count. */
export function __resetRequestLedgerForTests() {
  ledger.day = "";
  ledger.used = 0;
  recent.length = 0;
}
