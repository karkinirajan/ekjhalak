// lib/token-ledger.ts
//
// What the model pipeline has spent today, and what it may still spend.
//
// Its own module rather than a few variables inside lib/summarizer.ts, because
// summarizer.ts imports `server-only` and so cannot be loaded by a test. The
// arithmetic here is the part most worth testing and the part that quietly cost
// a day of translations when it did not exist, so it lives where a test can
// reach it.

import { envInt } from "./env";

/**
 * The daily token allowance this pipeline is willing to spend.
 *
 * Groq meters tokens per model per day. On the free tier that is 200,000, and a
 * full pass does not come close to fitting: measured batches cost 7.5k–9.5k
 * tokens each and a pass has around 47 of them, so one regeneration wants
 * roughly 376,000 — nearly twice the whole day's allowance, against a feed that
 * regenerates every few minutes.
 *
 * Before this cap existed the pass simply fired all 47 and collected 429s for
 * most of them. Nothing was logged, because a 429 only shelves the model, so
 * the visible symptom was a site with no translations and no explanation. The
 * quota was being spent on the first few batches that happened to win the race
 * rather than on the stories worth spending it on.
 *
 * Raise it to match a paid tier. Setting it to 0 disables the ledger entirely
 * and restores the old spend-until-refused behaviour.
 */
export const DAILY_TOKEN_BUDGET = envInt("GROQ_DAILY_TOKEN_BUDGET", 200_000, 0);

/**
 * Batches one pass may spend, however much budget is left.
 *
 * The ledger alone is not enough, because it cannot see how many passes a day
 * holds: with `revalidate: 300` a busy day is up to 288 regenerations, and the
 * first pass after midnight would otherwise take the entire allowance and leave
 * the other 287 with nothing.
 *
 * Three batches is thirty stories, about 24k tokens — so a 200k day supports
 * roughly eight full-value passes, and the rest of the day's passes serve
 * publisher text and archive hydration. That is the intended shape: stories are
 * ranked before they are batched, so each pass spends on its best thirty, and
 * `recordArticles` keeps what it bought. Tomorrow's passes hydrate those from
 * the archive for nothing and spend their budget on stories that are new.
 */
export const MAX_BATCHES_PER_PASS = envInt("GROQ_MAX_BATCHES_PER_PASS", 3, 1);

/**
 * What one batch is assumed to cost before it has been sent.
 *
 * Replaced by the real figure as soon as a batch reports its usage — Groq
 * returns `usage.total_tokens` on every success — so this only has to be close
 * enough to keep the first batch of a cold process from overdrawing.
 */
const ASSUMED_BATCH_TOKENS = 8_500;

/**
 * The two jobs the pipeline asks a model to do, metered separately.
 *
 * Summarizing and translating are different pieces of work with different
 * prompts, and since 2026-10-14 they run on different models — so they draw
 * from different quotas.
 *
 * The distinction matters and was got wrong once: Groq meters per organization
 * per MODEL, not per key. Three keys from one account share one 200,000-token
 * pot, verified by exhausting it on one key and watching the other two report
 * the same org and the same figure. Separate keys buy separation of concerns,
 * not capacity. Separate models buy capacity.
 *
 * Keeping one ledger per purpose is what makes that real: a single counter
 * across both would refuse work the other model still had budget for.
 */
export type ModelPurpose = "summary" | "translation";

export const MODEL_PURPOSES: readonly ModelPurpose[] = ["summary", "translation"];

interface Ledger {
  day: string;
  spent: number;
  observedBatchTokens: number;
}

const ledgers: Record<ModelPurpose, Ledger> = {
  summary: { day: "", spent: 0, observedBatchTokens: ASSUMED_BATCH_TOKENS },
  translation: { day: "", spent: 0, observedBatchTokens: ASSUMED_BATCH_TOKENS },
};

/** UTC, to match how Groq reports the window it is metering. */
function utcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

function ledgerFor(purpose: ModelPurpose): Ledger {
  const ledger = ledgers[purpose];
  const day = utcDay();
  if (day !== ledger.day) {
    ledger.day = day;
    ledger.spent = 0;
  }
  return ledger;
}

/** What a batch of this kind is currently believed to cost. */
export function batchTokenEstimate(purpose: ModelPurpose): number {
  return ledgers[purpose].observedBatchTokens;
}

/** Test seam: forget today's spend and the learned batch cost. */
export function __resetLedgerForTests() {
  for (const purpose of MODEL_PURPOSES) {
    ledgers[purpose] = {
      day: "",
      spent: 0,
      observedBatchTokens: ASSUMED_BATCH_TOKENS,
    };
  }
}

/** Test seam: what the ledger believes has been spent today. */
export function tokensSpentToday(purpose: ModelPurpose): number {
  return ledgerFor(purpose).spent;
}

/**
 * Tokens left in today's allowance for this job.
 *
 * Per process, like the rate limiter in lib/rate-limit.ts and honest about it:
 * several warm instances each keep their own ledger, so the real spend can be a
 * multiple of this. It is a brake on the common case — one instance firing
 * forty-seven batches at a twenty-five batch allowance — not an accounting
 * system. The 429 handler below corrects the ledger against Groq's own figure
 * whenever the real limit is reached, which is what keeps per-instance drift
 * from compounding across a day.
 */
export function tokensRemaining(purpose: ModelPurpose): number {
  if (DAILY_TOKEN_BUDGET === 0) return Number.POSITIVE_INFINITY;
  return Math.max(0, DAILY_TOKEN_BUDGET - ledgerFor(purpose).spent);
}

export function recordSpend(purpose: ModelPurpose, tokens: number) {
  const ledger = ledgerFor(purpose);
  ledger.spent += tokens;
  if (tokens > 0) {
    // Converge on what batches actually cost rather than trusting the guess.
    ledger.observedBatchTokens = Math.round(
      ledger.observedBatchTokens * 0.7 + tokens * 0.3,
    );
  }
}

/**
 * Believe Groq over the local count.
 *
 * A 429 for a daily limit carries the authoritative figure — "Limit 200000,
 * Used 197745" — which is better than anything this process can infer, and is
 * also the only way a cold instance learns that the day is already spent.
 *
 * Applied to one purpose, not both: the figure came from one key, and the other
 * key's allowance is untouched by it.
 */
export function syncLedgerFrom429(purpose: ModelPurpose, body: string) {
  const match = body.match(/Limit (\d+), Used (\d+)/);
  if (!match) return;
  const ledger = ledgerFor(purpose);
  const used = Number.parseInt(match[2] ?? "", 10);
  if (Number.isFinite(used)) ledger.spent = Math.max(ledger.spent, used);
}
