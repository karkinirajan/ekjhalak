// lib/summarizer.ts
// Bilingual enrichment against the Groq API. Server-only.
//
// One request handles a whole batch of stories and returns, for each, a clean
// summary in the language it was published in *and* a full translation of both
// headline and summary into the other one. Batching is not an optimisation here
// — it is the only way the workload fits. See the quota notes on MODEL_CHAIN.
//
// Everything degrades rather than throws: no key, exhausted quota, a malformed
// response or a timeout all end with the caller keeping whatever it already had.

/**
 * The length window quoted to the model.
 *
 * Guidance, not a gate. An earlier version rejected any summary outside these
 * bounds and retried, which meant a two-line wire brief — legitimately a
 * 160-character story — burned three requests and then fell through to raw
 * truncation anyway. The maximum is still enforced, by truncation rather than
 * rejection; the minimum is only ever a hint, because a short source cannot
 * honestly yield a long summary.
 *
 * The ceiling is double what it was. At 880 the model was dropping the second
 * half of any story with more than one thread to it — the reaction, the figure,
 * the thing that happens next — and a summary that stops after the first fact
 * is not shorter, it is incomplete. The card clamps to three lines regardless,
 * so the extra length costs nothing there; it is the reader panel, where the
 * whole brief is on screen, that gets the benefit.
 */
// Build-time guard: importing this from a client component is a build
// error rather than a shipped bundle. Holds the model prompts and reads GROQ_API_KEY.
import "server-only";

import { envOr, envString } from "./env";
import {
  SUMMARY_BOUNDS,
  SUMMARY_TARGET_WORDS,
  summaryBounds,
} from "./summary-length";

// Re-exported so lib/aggregator.ts and the rest keep one import site for
// everything about a summary, while the numbers stay testable.
export {
  SUMMARY_BOUNDS,
  SUMMARY_TARGET_WORDS,
  countWords,
  summaryBounds,
  type SummaryLang,
} from "./summary-length";

/**
 * Kept for the callers that still reason in one number — the widest and
 * narrowest of the two languages, so a shared check never rejects text that its
 * own language would have allowed.
 */
export const SUMMARY_MAX_CHARS = SUMMARY_BOUNDS.np.max;
export const SUMMARY_MIN_CHARS = SUMMARY_BOUNDS.en.min;

/**
 * How much publisher-written text is kept unrewritten.
 *
 * When a newsroom's own og:description is fuller than the blurb its feed
 * shipped, that text *is* the summary — it was written by the desk that
 * reported the story, and putting a model between the reader and it can only
 * lose something.
 *
 * It was 2,640, two and a half times the target, and that single number is why
 * the median summary on this site measured 1,910 characters against a brief
 * asking for about 964: almost every story took the verbatim path and was shown
 * at whatever length its publisher wrote, up to the cap. Anything longer than
 * the language's own ceiling now goes to the model to be compressed, which is
 * what the verbatim path was always supposed to mean.
 */
export const VERBATIM_MAX_CHARS = SUMMARY_BOUNDS.np.max;

/** Stories per request. */
/**
 * Stories per request.
 *
 * Three, not ten, and the reason is a limit separate from the daily one. Groq
 * sends `x-ratelimit-limit-tokens: 8000` — a *per minute* ceiling — and a batch
 * costs about 835 tokens a story. Ten stories is 8,350 tokens in one request,
 * which exceeds the whole minute's allowance on its own; three requests of that
 * size in flight is 25,050 against 8,000, so most of them could only ever 429.
 *
 * Three stories is 2,505 tokens a request and 7,515 with the default three in
 * flight, which fits with room for the reply. Raising this without lowering
 * GROQ_CONCURRENCY puts the stage back where it was.
 */
const BATCH_SIZE = clampInt(process.env.GROQ_BATCH_SIZE, 3, 1, 40);
/** Requests in flight at once. */
const CONCURRENCY = clampInt(process.env.GROQ_CONCURRENCY, 3, 1, 8);
const REQUEST_TIMEOUT_MS = 45_000;

/**
 * Models tried in order, first to answer wins.
 *
 * This list is a quota strategy, not indecision. Groq meters requests and
 * tokens per model per minute *and* per day, so keeping this a chain — even a
 * chain of one, as it is by default — means adding a second Groq model, or a
 * different one entirely, is a one-line GROQ_MODEL change rather than a
 * rewrite of the call site.
 *
 * GROQ_MODEL still wins — set it to a single name to pin one model, or to a
 * comma-separated list to replace the chain outright. Whatever it names is
 * tried first and the default follows as a fallback.
 */
/**
 * The model each job runs on, and what it falls back to.
 *
 * Summarizing is comprehension-heavy — read a story, decide what matters — and
 * gpt-oss-120b is the strongest reasoner on Groq's free list, so it does that.
 * Its weakness is that Nepali is not on its model card, which matters far more
 * for writing Nepali than for understanding it.
 *
 * Translating is the half where that weakness would show, so it runs on
 * qwen3.8-27b, which lists Nepali among its 119 supported languages. That model
 * is preview tier and Groq retired its predecessor qwen3.6-27b on 14 September,
 * which is exactly why it is the head of a chain rather than a fixed name: when
 * a model 404s, callModel shelves it for 24 hours and askChain moves to the
 * next entry, so a retirement costs one failed batch rather than a dead stage.
 * gpt-oss-120b is that next entry — worse Nepali than Qwen, far better than no
 * translation at all.
 */
/**
 * Gemini sits last in both chains, and last is the whole point.
 *
 * It is there for capacity, not quality. Measured on eight of this site's own
 * Nepali articles against the production prompt, Gemini carried 81-86% of the
 * figures where Groq's qwen carried 95%, and it silently converted Bikram
 * Sambat dates the prompt had told it to leave alone: "असोज २२ देखि कार्तिक ३०"
 * came back as "October 8 to November 16". For a news desk that is a factual
 * error, not a stylistic one.
 *
 * What it does have is quota. In the same run it was the only provider to
 * finish all eight articles; qwen managed six and gpt-oss one, both stopped by
 * Groq's daily pool. So it runs when Groq has nothing left, where a translation
 * that rounds a date beats no translation at all — and never before then.
 */
// Flash-Lite for both, and the reason is a limit the research got wrong.
//
// It reported Gemini's free tier at 1,000-1,500 requests a day. Measured from
// the API's own 429: gemini-2.5-flash allows TWENTY generate_content requests
// per day per project, with a 43,877-second retry delay — twelve hours. Twenty
// requests is two passes, not a day's capacity, and the fallback was silently
// refused on the first day it was asked to work.
//
// gemini-3.1-flash-lite still answers after the same traffic exhausted Flash,
// so Lite is what both stages fall back to. Its figure retention measured 86%
// against qwen's 95% on this site's own articles, which is the price of being
// the provider that still answers.
const GEMINI_SUMMARY_MODEL = envOr(
  "GEMINI_MODEL_SUMMARY",
  "gemini-3.1-flash-lite",
);
const GEMINI_TRANSLATE_MODEL = envOr(
  "GEMINI_MODEL_TRANSLATE",
  "gemini-3.1-flash-lite",
);

/**
 * OpenRouter's free models, which meter requests a day rather than tokens.
 *
 * These two defaults are a starting point, not a measured choice. Gemma 4 is
 * the better bet for Nepali on the strength of Google's Devanagari coverage,
 * and Nemotron Super is the largest free model with output headroom to spare —
 * but neither has been scored against this pipeline's prompts. Run
 * scripts/translate-bakeoff.mjs with the production prompt before promoting
 * either ahead of Groq in the chain. Guessing which model is better at Nepali
 * from its parameter count is how qwen3.8-27b nearly got dropped for a fault
 * that turned out to be in the test harness.
 *
 * Free model IDs churn — OpenRouter's catalogue dropped one mid-October — so a
 * vanished model must degrade to the next link rather than stop the pass. It
 * does: an unknown ID answers 404, and callModel shelves a 404 for the process.
 */
const OPENROUTER_SUMMARY_MODEL = envOr(
  "OPENROUTER_MODEL_SUMMARY",
  "nvidia/nemotron-3-super-120b-a12b:free",
);
const OPENROUTER_TRANSLATE_MODEL = envOr(
  "OPENROUTER_MODEL_TRANSLATE",
  "google/gemma-4-31b-it:free",
);

/**
 * Is there a provider left when Groq's day is spent?
 *
 * The daily ledger is a brake on Groq's pool, and every gate in this file asks
 * it before starting work. Once a second provider sits at the end of the chain
 * those gates have to ask a wider question, or the fallback is unreachable on
 * the one day it matters.
 *
 * OpenRouter counts as a fallback only while it has requests left today. Its
 * key being present is not enough: a spent OpenRouter allowance that still
 * answered `true` here would reopen every Groq gate in this file against a
 * provider that is going to refuse, and the pass would spend its deadline
 * collecting 429s — which is the exact failure the token ledger was written to
 * stop, rebuilt one provider over.
 */
function hasFallback(): boolean {
  if (envString("GEMINI_API_KEY")) return true;
  return Boolean(envString("OPENROUTER_API_KEY")) && requestsRemaining() > 0;
}

/**
 * Groq leads, OpenRouter follows, Gemini last.
 *
 * Groq first because it is the only link measured against these prompts in
 * production. OpenRouter ahead of Gemini on allowance alone: 50 free requests
 * a day against Gemini's 20, and 1,000 once the account has bought $10 once.
 * Gemini stays at the end as the provider of last resort rather than being
 * removed, because its 20 requests are 20 more than nothing on the day both
 * others are spent.
 */
const DEFAULT_MODELS: Record<ModelPurpose, readonly string[]> = {
  summary: [
    "openai/gpt-oss-120b",
    `openrouter:${OPENROUTER_SUMMARY_MODEL}`,
    `gemini:${GEMINI_SUMMARY_MODEL}`,
  ],
  translation: [
    "qwen/qwen3.8-27b",
    "openai/gpt-oss-120b",
    `openrouter:${OPENROUTER_TRANSLATE_MODEL}`,
    `gemini:${GEMINI_TRANSLATE_MODEL}`,
  ],
};

/**
 * Which API a chain entry belongs to.
 *
 * A prefix is the marker. Everything unprefixed is Groq, which keeps the
 * existing GROQ_MODEL overrides meaning exactly what they always did.
 *
 * Only the FIRST colon separates prefix from model, which matters here in a way
 * it did not when Gemini was the only prefix: OpenRouter's free model IDs end
 * in `:free`, so `openrouter:google/gemma-4-31b-it:free` has two colons and
 * splitting on the wrong one asks OpenRouter for a model called
 * `google/gemma-4-31b-it` — a paid ID, which either bills the account or 404s.
 */
type Provider = "groq" | "gemini" | "openrouter";

const PROVIDER_PREFIXES: ReadonlyArray<readonly [string, Provider]> = [
  ["gemini:", "gemini"],
  ["openrouter:", "openrouter"],
];

function providerOf(entry: string): Provider {
  for (const [prefix, provider] of PROVIDER_PREFIXES) {
    if (entry.startsWith(prefix)) return provider;
  }
  return "groq";
}

function bareModel(entry: string): string {
  for (const [prefix] of PROVIDER_PREFIXES) {
    if (entry.startsWith(prefix)) return entry.slice(prefix.length);
  }
  return entry;
}

/** Does this entry name a provider explicitly? */
const hasProviderPrefix = (entry: string) =>
  PROVIDER_PREFIXES.some(([prefix]) => entry.startsWith(prefix));

/**
 * Per-job override, falling back to the shared GROQ_MODEL, then the defaults.
 *
 * Two names each, because the deployment settled on GROQ_MODEL_SUMMARY and
 * GROQ_MODEL_TRANSLATE while this file was written against EKJHALAK_*_MODEL.
 * Reading both costs nothing and means a correct-looking .env is never silently
 * ignored — a model name that does not take effect shows up as a quota bill
 * against the wrong model, which is close to invisible.
 */
const MODEL_ENV: Record<ModelPurpose, readonly string[]> = {
  summary: ["GROQ_MODEL_SUMMARY", "EKJHALAK_SUMMARY_MODEL"],
  translation: ["GROQ_MODEL_TRANSLATE", "EKJHALAK_TRANSLATION_MODEL"],
};

/**
 * Groq model IDs are namespaced — `qwen/qwen3.8-27b`, not `qwen3.8-27b` — and
 * the bare name 404s rather than resolving. A 404 shelves the model for 24
 * hours, so a missing prefix in configuration reads as "the translator is
 * permanently down" with nothing pointing at the cause.
 *
 * Only the vendors actually in play are mapped. An unknown bare name is passed
 * through untouched and allowed to fail honestly, because guessing a namespace
 * for it would be inventing configuration the operator did not write.
 */
const MODEL_NAMESPACE: Record<string, string> = {
  "qwen3.8-27b": "qwen/qwen3.8-27b",
  "qwen3.6-27b": "qwen/qwen3.6-27b",
  "gpt-oss-120b": "openai/gpt-oss-120b",
  "gpt-oss-20b": "openai/gpt-oss-20b",
};

function normalizeModelId(name: string): string {
  // A prefixed entry is already fully qualified, and must not be touched: a
  // Groq namespace guessed onto an OpenRouter ID would be nonsense.
  if (hasProviderPrefix(name)) return name;
  if (name.includes("/")) return name;
  const qualified = MODEL_NAMESPACE[name];
  if (qualified) {
    console.warn(
      `[model] "${name}" is missing its vendor prefix — using "${qualified}". ` +
        "Groq 404s the bare name, which would shelve the model for 24 hours.",
    );
    return qualified;
  }
  return name;
}

/**
 * Deliberately far above what the answer needs (~300 tokens per story per
 * language).
 *
 * A reasoning model bills its thinking against this same ceiling and spends it
 * first, so a tight cap can starve the actual answer before it is written —
 * the response comes back cut off mid-JSON and fails to parse rather than
 * arriving short. A ceiling this high, against gpt-oss-120b's completion
 * budget on Groq, cannot plausibly be reached by a rewrite-and-translate task
 * this small, so it costs nothing on a normal request and only exists for the
 * one that would otherwise be truncated.
 */
/**
 * Output ceiling, set to the smallest any model in the chains accepts.
 *
 * It was 32,000, which gpt-oss-120b allows and qwen3.8-27b does not: qwen caps
 * max_completion_tokens at 16,384 and answers anything higher with a 400. A 400
 * is treated as "this model will never work" and shelves it for twenty-four
 * hours, so the translator was being disabled on its first request of every
 * process — not by its Nepali, not by quota, but by a number in this file.
 *
 * 16,384 is qwen's limit and comfortably above what any batch needs: three
 * stories of about 140 words each is well under a thousand tokens of output.
 * The ceiling exists to stop a runaway reply, not to be reached.
 */
const MAX_OUTPUT_TOKENS = 16_384;

/**
 * One key per job.
 *
 * Groq meters tokens per key per day, so two keys is two allowances rather than
 * one shared pot. Summarizing every new story costs about 142,000 tokens a day
 * at this feed's volume and translating them costs the same again — 284,000
 * against a single key's 200,000, which is why for weeks almost nothing was
 * translated. Split across two keys, each job has room.
 *
 * GROQ_API_KEY remains the fallback for both, so a deployment that sets only
 * the one key keeps working exactly as before — on a single shared allowance.
 */
function keyFor(purpose: ModelPurpose): string | undefined {
  const specific =
    purpose === "summary"
      ? envString("EKJHALAK_SUMMARY")
      : envString("EKJHALAK_TRANSLATION");
  return specific ?? envString("GROQ_API_KEY");
}

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

function clampInt(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function modelChain(purpose: ModelPurpose): string[] {
  const names = (value: string | undefined) =>
    (value ?? "")
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean)
      .map(normalizeModelId);

  // A job-specific override wins outright. GROQ_MODEL is honoured only for
  // summarizing: it predates the split, and a deployment that set it meant the
  // summarizer — forcing it on the translator too would silently undo the
  // reason translation runs on a different model.
  const configured = MODEL_ENV[purpose].flatMap((key) =>
    names(envString(key)),
  );
  const shared = purpose === "summary" ? names(envString("GROQ_MODEL")) : [];
  return [...new Set([...configured, ...shared, ...DEFAULT_MODELS[purpose]])];
}

// ── Text hygiene ────────────────────────────────────────────────────────────

function normalizeText(text: string): string {
  return text
    .trim()
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ");
}

// Owned by lib/article-parse.ts, used here and re-exported for existing callers.
//
// It used to be declared in both places. Two copies of a boilerplate regex is
// two copies that drift, and the parse module is the one that can hold it: this
// module is `server-only`, so the project's plain-Node test runner cannot
// import it, while article-parse.ts is deliberately pure for exactly that
// reason.
import { looksLikeBoilerplate } from "./article-parse";
import {
  DAILY_TOKEN_BUDGET,
  MAX_BATCHES_PER_PASS,
  batchTokenEstimate,
  recordSpend,
  syncLedgerFrom429,
  tokensRemaining,
  tokensSpentToday,
  type ModelPurpose,
} from "./token-ledger";
import {
  DAILY_REQUEST_BUDGET,
  msUntilRequestSlot,
  recordRequestSpend,
  requestsRemaining,
  requestsUsedToday,
  syncRequestLedgerFrom429,
} from "./request-ledger";

export { looksLikeBoilerplate };

export function hardTruncateSummary(
  text: string,
  max: number = SUMMARY_MAX_CHARS,
): string {
  const cleaned = normalizeText(text);
  if (cleaned.length <= max) return cleaned;

  const slice = cleaned.slice(0, max);
  const sentenceMatch = slice.match(/^[\s\S]*[.।!?](?=\s|$)/);
  if (sentenceMatch && sentenceMatch[0].length >= Math.floor(max * 0.5)) {
    return sentenceMatch[0].trim();
  }

  const lastSpace = slice.lastIndexOf(" ");
  const safeSlice =
    lastSpace > Math.floor(max * 0.5) ? slice.slice(0, lastSpace) : slice;
  return `${safeSlice.trim().replace(/[,;:\-–—]+$/, "")}…`;
}

/**
 * Is this text actually in the language we asked for?
 *
 * Both translation directions fail the same way when a model gives up: it echoes
 * the source back untranslated. Devanagari and Latin share no code points, so
 * counting which script the letters belong to settles it.
 *
 * A proportion rather than a presence test, because either language legitimately
 * borrows from the other — English copy quotes a Nepali party name in Devanagari,
 * Nepali copy leaves "IMF" and "COVID-19" in Latin. A single stray glyph must not
 * condemn an otherwise correct translation, so the bar is which script carries
 * the majority of the letters.
 */
const DEVANAGARI_LETTER = /[ऀ-ॿ]/gu;
const LATIN_LETTER = /[A-Za-z]/gu;

function isInLanguage(text: string, lang: "en" | "np"): boolean {
  const cleaned = normalizeText(text);
  if (cleaned.length < 8) return false;

  const devanagari = cleaned.match(DEVANAGARI_LETTER)?.length ?? 0;
  const latin = cleaned.match(LATIN_LETTER)?.length ?? 0;
  if (devanagari + latin === 0) return false;

  return lang === "np" ? devanagari > latin : latin > devanagari;
}

// ── Per-model cooldowns ─────────────────────────────────────────────────────
//
// A 429 means one model is out, not that Groq is down, so the cooldown is
// keyed by model and the chain simply moves on to the next one.

const cooldownUntil = new Map<string, number>();

function isCoolingDown(model: string): boolean {
  return (cooldownUntil.get(model) ?? 0) > Date.now();
}

function coolDown(model: string, ms: number) {
  cooldownUntil.set(model, Date.now() + ms);
}

/**
 * What the last reply said about the per-minute window.
 *
 * Groq reports both limits on every response — `x-ratelimit-remaining-tokens`
 * and `x-ratelimit-reset-tokens` — and the per-minute one is the tighter of the
 * two by far: 8,000 tokens against 200,000 a day. Reading it is strictly better
 * than inferring it, and it is free, since it rides on a reply we already have.
 *
 * When a model has less left in the minute than a batch costs, the next batch
 * waits for the window instead of spending a request to be told no. A 429 is
 * not harmless: it shelves the model for thirty seconds, so one avoidable
 * refusal costs far more than the pause that would have prevented it.
 */
const minuteWindow = new Map<string, { remaining: number; resetAt: number }>();

function noteRateLimit(model: string, res: Response) {
  const remaining = Number.parseInt(
    res.headers.get("x-ratelimit-remaining-tokens") ?? "",
    10,
  );
  if (!Number.isFinite(remaining)) return;

  // "20.777s", "4m19.2s" — minutes are optional and seconds may be fractional.
  const raw = res.headers.get("x-ratelimit-reset-tokens") ?? "";
  const parts = raw.match(/(?:(\d+)m)?([\d.]+)s/);
  const seconds = parts
    ? (parts[1] ? Number.parseInt(parts[1], 10) * 60 : 0) +
      Number.parseFloat(parts[2] ?? "0")
    : 60;

  minuteWindow.set(model, {
    remaining,
    resetAt: Date.now() + Math.max(0, seconds) * 1_000,
  });
}

/** Milliseconds to wait before this model can afford `tokens` again. */
function waitForMinuteWindow(model: string, tokens: number): number {
  const window = minuteWindow.get(model);
  if (!window) return 0;
  if (Date.now() >= window.resetAt) return 0;
  if (window.remaining >= tokens) return 0;
  return window.resetAt - Date.now();
}

const DAILY_QUOTA_COOLDOWN_MS = 30 * 60 * 1_000;
const MIN_COOLDOWN_MS = 30 * 1_000;

/**
 * How long to shelve a model after a 429.
 *
 * Groq reports the wait in a standard `Retry-After` header, which is
 * authoritative when present. Failing that, its error message names which
 * quota tripped — "requests per day" / "RPD" clears only at the daily reset,
 * so retrying it every thirty seconds for the rest of the day is pure noise
 * and gets the long shelf; a per-minute limit clears on its own and gets the
 * short one.
 */
function cooldownFor(res: Response, body: string): number {
  const retryAfter = Number.parseFloat(res.headers.get("retry-after") ?? "");
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.max(MIN_COOLDOWN_MS, retryAfter * 1_000);
  }

  if (/per[ -]day|\bRPD\b|\bTPD\b/i.test(body)) return DAILY_QUOTA_COOLDOWN_MS;

  const match = body.match(/try again in\s+(?:(\d+)m)?([\d.]+)s/i);
  if (match) {
    const minutes = match[1] ? Number.parseInt(match[1], 10) : 0;
    const seconds = Number.parseFloat(match[2] ?? "");
    return Math.max(MIN_COOLDOWN_MS, (minutes * 60 + seconds) * 1_000);
  }

  return MIN_COOLDOWN_MS;
}

// ── Prompt ──────────────────────────────────────────────────────────────────

/**
 * Two prompts, not one.
 *
 * Until 2026-10-14 a single call was asked to summarize *and* translate in one
 * reply, and rule 6 of that prompt had to plead with the model to keep the two
 * language versions saying the same thing. That is a request, not a guarantee:
 * the model wrote both versions from the source independently, so each could
 * pick up a different detail, and the only thing holding them together was the
 * instruction not to drift.
 *
 * Splitting the work removes the possibility. The summarizer sees the source
 * and writes one paragraph in the source's own language; the translator sees
 * that finished paragraph and never sees the source at all, so it has nothing
 * to drift towards. The two versions state the same facts because the second is
 * made from the first, not because a rule asked for it.
 *
 * It also means each call does one job, with a prompt about that job — and
 * since the two authenticate with different keys, two daily allowances.
 */
const SUMMARY_SYSTEM_PROMPT =
  `You are the desk editor of a Nepali newsroom. You receive a JSON array of source items. ` +
  `For every item, write ONE summary paragraph in the item's own source language, and a headline for it in that same language. ` +
  `Do not translate. Do not write any other language. The translation is another desk's job.\n\n` +
  `Rules, all of them binding:\n` +
  `1. Length: about ${SUMMARY_TARGET_WORDS} words. Count words, not characters. A few words either side is fine. Use the length the story earns: a wire brief with one fact stays short, a story with several threads uses the room. Never pad to reach the number and never stop before the story is told.\n` +
  `2. Completeness is the priority. Carry every load-bearing fact across: who acted, what they did, when and where, the numbers, the stated reason, who is affected, what happens next, and any reaction or denial the source records. A summary that reports the event but drops the consequence has failed.\n` +
  `3. Precision over compression. Keep every name, title, place, date, figure, currency amount and unit exactly as the source gives it — never round, convert, approximate or re-date. Preserve the source's own hedging: "alleged" stays alleged, "reportedly" stays reportedly, an accusation never becomes a finding, a proposal never becomes a decision.\n` +
  `4. Attribute claims to whoever made them. "The minister said X" must not become "X". If the source names who is speaking, so must you.\n` +
  `5. Use only what the source says. Never add background, context, explanation or consequence that is not in the text in front of you, however obvious it seems.\n` +
  `6. Every sentence must be complete and self-contained. Never end mid-thought or trail off into an ellipsis.\n` +
  `7. Neutral newsroom tone. One paragraph. No headings, labels, lists, markdown, emoji or first person.\n` +
  `8. Strip publisher chrome: subscription pitches, "read more", bylines, datelines, copyright lines, section tags, navigation words.\n` +
  `9. An item marked "verbatim": true already carries the publisher's own summary. Reproduce it EXACTLY as supplied, character for character, with no rewriting, trimming or reordering. It is not to be improved.\n` +
  `10. Respond with exactly one JSON object of the shape {"items": [{"id", "title", "summary"}, ...]} — one entry per input item, in the same order, echoing the item's id exactly. No markdown fences, no prose outside the object, no key besides "items".`;

const TRANSLATION_SYSTEM_PROMPT =
  `You are the translation desk of a Nepali newsroom. You receive a JSON array of finished news summaries, each with its headline, and the language to render it in. ` +
  `Translate each one. You are not summarizing, not editing, and not reporting — the text in front of you is already the finished story.\n\n` +
  `Rules, all of them binding:\n` +
  `1. Translate the whole text. Every clause, every sentence. A translation that drops a sentence has failed, however minor the sentence looked.\n` +
  `2. Add nothing. No background, no context, no explanation the source paragraph does not contain. If the paragraph is unclear, it stays unclear.\n` +
  `3. Keep every name, title, place, date, figure, currency amount and unit exactly as given — never round, convert, approximate or re-date. 23 stays 23; Rs 4.2 billion stays Rs 4.2 billion.\n` +
  `4. Preserve hedging and attribution exactly. "alleged" stays alleged, "reportedly" stays reportedly, "the minister said" keeps the minister. An accusation never becomes a finding.\n` +
  `5. Write natural, idiomatic prose in the target language — the register of a printed daily, not a word-for-word gloss. For Nepali: Devanagari script, the register of a Nepali daily, never English sentences transliterated into Devanagari. Transliterate proper nouns and organisation names the way Nepali papers do. Use Devanagari digits only where the source does.\n` +
  `6. Match the source paragraph's length and sentence order. The translation is the same story, said in another language, in the same sequence.\n` +
  `7. Every sentence must be complete. Never end mid-thought or trail off into an ellipsis.\n` +
  `8. One paragraph. No headings, labels, lists, markdown, emoji or first person.\n` +
  `9. Respond with exactly one JSON object of the shape {"items": [{"id", "title", "summary"}, ...]} — one entry per input item, in the same order, echoing the item's id exactly. No markdown fences, no prose outside the object, no key besides "items".`;

// ── Public shape ────────────────────────────────────────────────────────────

export interface EnrichInput {
  id: string;
  title: string;
  /** Raw body from the feed — may be empty, over-long, or publisher chrome. */
  body: string;
  lang: "en" | "np";
  /**
   * The body is already the summary — the publisher's own words, at a length
   * the reader can take. The model is told to reproduce it unchanged and only
   * write the translation; the caller enforces that regardless of what comes
   * back, so this is a token saving rather than a trust decision.
   */
  verbatim?: boolean;
}

export interface EnrichResult {
  /** The summary in the story's own language. */
  summary: string;
  /**
   * Headline and summary in the other language. Empty strings when the model
   * answered in the wrong script — callers fall back to the original.
   */
  titleTranslated: string;
  summaryTranslated: string;
}

/** One language per reply, for both stages — they share this shape. */
interface ModelReply {
  id?: string;
  title?: string;
  summary?: string;
}

/**
 * Can the pipeline summarize at all?
 *
 * Asks keyFor rather than GROQ_API_KEY directly: since the split, a deployment
 * may set EKJHALAK_SUMMARY and EKJHALAK_TRANSLATION and no shared key at all,
 * and reading the old name here would have reported the whole stage
 * unconfigured while two perfectly good keys sat in the environment.
 */
export function isEnrichmentConfigured(): boolean {
  return Boolean(keyFor("summary"));
}

/**
 * Longest source body we send.
 *
 * Raised alongside the output ceiling. At 2,400 the model was being asked to
 * write a fuller summary from a body that had already been cut — the extra
 * length would have come from somewhere other than the source, which is the one
 * thing this pipeline must never do.
 */
const MAX_SOURCE_CHARS = 6_000;

const langName = (lang: string) => (lang === "np" ? "Nepali" : "English");

function buildSummaryBody(batch: EnrichInput[]) {
  const payload = batch.map((item) => ({
    id: item.id,
    sourceLanguage: langName(item.lang),
    headline: normalizeText(item.title).slice(0, 400),
    body: normalizeText(item.body).slice(0, MAX_SOURCE_CHARS),
    ...(item.verbatim ? { verbatim: true } : {}),
  }));

  return {
    messages: [
      { role: "system", content: SUMMARY_SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify(payload) },
    ],
    temperature: 0.2,
    max_completion_tokens: MAX_OUTPUT_TOKENS,
    response_format: { type: "json_object" },
  };
}

interface TranslateInput {
  id: string;
  title: string;
  summary: string;
  /** The language the finished summary is in. */
  from: "en" | "np";
}

function buildTranslationBody(batch: TranslateInput[]) {
  const payload = batch.map((item) => ({
    id: item.id,
    translateInto: langName(item.from === "np" ? "en" : "np"),
    headline: item.title,
    // No source body. The translator works from the finished summary only, so
    // there is nothing for it to drift towards.
    summary: item.summary,
  }));

  return {
    messages: [
      { role: "system", content: TRANSLATION_SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify(payload) },
    ],
    temperature: 0.2,
    max_completion_tokens: MAX_OUTPUT_TOKENS,
    response_format: { type: "json_object" },
  };
}

/**
 * One batch against one model.
 *
 * Returns null for "this model could not answer, try the next one" and an array
 * for "this model answered". An empty array is a real answer — a model that
 * returns nothing usable should not send the caller round the chain again.
 */
/**
 * How long this one model call may take, given the run it belongs to.
 *
 * The run's deadline is checked before a batch is picked up, which decides
 * whether to *start* a call; this decides how long the one it started may run.
 * Without it a batch claimed with two seconds left on the clock still gets the
 * full 45-second request timeout, and three concurrent workers turn a nine
 * second enrichment slice into a thirty-two second one — measured, and the
 * reason the feed endpoint was crossing Netlify's 30-second request limit and
 * returning 502 to whichever reader happened to arrive on a stale cache.
 */
function requestTimeout(deadline: number): number {
  return Math.max(1, Math.min(REQUEST_TIMEOUT_MS, deadline - Date.now()));
}

/**
 * The same request, in whichever dialect the provider speaks.
 *
 * Groq is OpenAI-shaped; Gemini puts the system prompt in `systemInstruction`,
 * the user turn in `contents`, and asks for JSON through `responseMimeType`.
 * Translating between the two here keeps every prompt, every budget and every
 * cooldown in one place — the alternative is a second copy of the chain that
 * drifts from this one.
 */
function geminiRequest(
  model: string,
  apiKey: string,
  body: Record<string, unknown>,
): { url: string; init: RequestInit } {
  const messages = (body.messages ?? []) as { role: string; content: string }[];
  const system = messages.find((m) => m.role === "system")?.content ?? "";
  const user = messages.find((m) => m.role === "user")?.content ?? "";

  return {
    url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ parts: [{ text: user }] }],
        generationConfig: {
          temperature: body.temperature ?? 0.2,
          maxOutputTokens: body.max_completion_tokens ?? MAX_OUTPUT_TOKENS,
          responseMimeType: "application/json",
        },
      }),
    },
  };
}

/** Gemini's reply, reduced to the two things the rest of this file reads. */
function readGemini(data: unknown): { text: string; tokens: number } | null {
  const body = data as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    usageMetadata?: { totalTokenCount?: number };
  };
  const candidate = body?.candidates?.[0];
  if (!candidate) return null;
  // MAX_TOKENS means the JSON is cut off and will not parse; the next model in
  // the chain serves this batch better than salvage would.
  if (candidate.finishReason && candidate.finishReason !== "STOP") return null;
  const text = candidate.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  return { text: text.trim(), tokens: body.usageMetadata?.totalTokenCount ?? 0 };
}

async function callModel<T>(
  entry: string,
  requestBody: Record<string, unknown>,
  deadline: number,
  purpose: ModelPurpose,
): Promise<T[] | null> {
  const provider = providerOf(entry);
  const model = bareModel(entry);
  const apiKey =
    provider === "gemini"
      ? envString("GEMINI_API_KEY")
      : provider === "openrouter"
        ? envString("OPENROUTER_API_KEY")
        : keyFor(purpose);
  if (!apiKey) return null;

  // Last gate before the request leaves. askChain checks this too, but the
  // allowance can be spent by a concurrent worker between that check and this
  // one — there are three requests in flight by default — and the whole point
  // of the ledger is that an avoidable refusal still costs a slot.
  if (provider === "openrouter" && requestsRemaining() <= 0) return null;

  let res: Response;
  try {
    if (provider === "gemini") {
      const { url, init } = geminiRequest(model, apiKey, requestBody);
      res = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(requestTimeout(deadline)),
      });
    } else {
      // OpenRouter speaks the same OpenAI dialect as Groq, so the request body,
      // the reply shape and the parsing below are shared verbatim. Only the URL,
      // the key and two optional attribution headers differ — which is the whole
      // reason adding this provider was cheap.
      const openrouter = provider === "openrouter";

      // Counted before the reply, not after. A request that times out or 500s
      // has still been made, and OpenRouter states failed requests may count
      // against the daily cap, so crediting only successes would let a failing
      // model drain the real allowance invisibly.
      if (openrouter) recordRequestSpend();

      res = await fetch(openrouter ? OPENROUTER_ENDPOINT : GROQ_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          // Optional, and only sent when configured: OpenRouter attributes
          // traffic to these on its public leaderboards. Omitted entirely
          // rather than sent blank, because an empty Referer is worse than none.
          ...(openrouter ? openrouterAttribution() : {}),
        },
        body: JSON.stringify({ ...requestBody, model }),
        signal: AbortSignal.timeout(requestTimeout(deadline)),
      });
    }
  } catch {
    // Timeout or transport failure. Shelve briefly so a flapping model does not
    // eat the whole run's deadline batch after batch.
    coolDown(entry, MIN_COOLDOWN_MS);
    return null;
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    if (res.status === 429 || res.status === 503) {
      // Daily-quota exhaustion used to be the quietest failure in the pipeline:
      // the model was shelved, enrichment returned nothing, and the site served
      // untranslated stories with no line anywhere saying why. It took an
      // instrumented run through four call layers to find it. It says so now.
      if (/per[ -]day|\bTPD\b|\bRPD\b/i.test(detail)) {
        // Each refusal belongs in its own provider's ledger and nowhere else.
        // Gemini and OpenRouter meter requests a day rather than tokens, and
        // writing either refusal into the token count would close Groq's budget
        // on the strength of someone else's limit.
        if (provider === "groq") syncLedgerFrom429(purpose, detail);
        if (provider === "openrouter") syncRequestLedgerFrom429(detail);
        const used =
          provider === "openrouter"
            ? `${requestsUsedToday()} of ${DAILY_REQUEST_BUDGET} requests used`
            : `${tokensSpentToday(purpose).toLocaleString()} tokens used`;
        console.warn(
          `[${purpose}] ${model} daily quota exhausted — ${used}. ` +
            "Stories keep their publisher text until it resets.",
        );
      }
      coolDown(entry, cooldownFor(res, detail));
    } else if (res.status === 400 || res.status === 404) {
      // Bad model name or a request shape this model rejects — never going to
      // work, so take it out of the chain for this process.
      coolDown(entry, 24 * 60 * 60 * 1_000);
      console.warn(`[enrich] ${entry} rejected the request: ${detail.slice(0, 200)}`);
    } else {
      coolDown(entry, MIN_COOLDOWN_MS);
    }
    return null;
  }

  if (provider === "groq") noteRateLimit(entry, res);

  const data = await res.json().catch(() => null);

  if (provider === "gemini") {
    const reply = readGemini(data);
    if (!reply?.text) return null;
    // Gemini's spend is deliberately not charged to the token ledger: that
    // ledger models Groq's 200,000-a-day pool, and Gemini is only ever reached
    // because that pool is empty. Charging it would make the fallback close the
    // budget it exists to work around.
    try {
      const parsed = JSON.parse(reply.text);
      const items = Array.isArray(parsed) ? parsed : parsed?.items;
      return Array.isArray(items) ? (items as T[]) : null;
    } catch {
      return null;
    }
  }

  // Charge the ledger with what this actually cost, before any of the reasons
  // the reply might be unusable. The tokens were spent either way, and a reply
  // that fails to parse is exactly the case where forgetting to count it would
  // let a broken model drain the day.
  // Only Groq's spend belongs in Groq's token ledger. OpenRouter reports usage
  // in the same field, but charging it here would make the fallback close the
  // very budget it exists to work around — the same mistake the Gemini branch
  // above avoids, and easier to make here because the reply shape is identical.
  if (provider === "groq") {
    const spent = data?.usage?.total_tokens;
    if (typeof spent === "number" && Number.isFinite(spent))
      recordSpend(purpose, spent);
  }

  const choice = data?.choices?.[0];
  if (!choice) return null;

  // A truncated answer is not a partial answer: the JSON will not parse, and the
  // stories in this batch are better served by the next model than by salvage.
  if (choice.finish_reason && choice.finish_reason !== "stop") {
    console.warn(`[enrich] ${entry} stopped early: ${choice.finish_reason}`);
    return null;
  }

  const text = (choice.message?.content ?? "").trim();
  if (!text) return null;

  try {
    const parsed = JSON.parse(text);
    const items = Array.isArray(parsed) ? parsed : parsed?.items;
    return Array.isArray(items) ? (items as T[]) : null;
  } catch {
    return null;
  }
}

/**
 * Walk the model chain for any request shape.
 *
 * Factored out of `enrichBatch` when verification became a second kind of call.
 * The chain, the cooldowns and the "stop at the deadline rather than let five
 * models each spend a request timeout" rule are the same for both, and they are
 * the parts that took production down when they were wrong — duplicating them
 * for a second caller would have been the obvious way to get them wrong again.
 */
/**
 * Optional attribution headers, present only when configured.
 *
 * OpenRouter reads these to credit traffic on its public model leaderboards.
 * Both are omitted when unset rather than sent empty, because `Referer: ""` is
 * a malformed header where a missing one is simply a missing one.
 */
function openrouterAttribution(): Record<string, string> {
  const headers: Record<string, string> = {};
  const referer = envString("OPENROUTER_SITE_URL") ?? envString("SITE_URL");
  const title = envString("OPENROUTER_APP_TITLE");
  if (referer) headers["HTTP-Referer"] = referer;
  if (title) headers["X-Title"] = title;
  return headers;
}

async function askChain<T>(
  requestBody: Record<string, unknown>,
  deadline: number,
  purpose: ModelPurpose,
): Promise<T[]> {
  for (const model of modelChain(purpose)) {
    if (isCoolingDown(model)) continue;
    if (Date.now() >= deadline) break;

    // Skip a spent OpenRouter allowance rather than spend a slot proving it is
    // spent. Unlike a Groq 429, which only shelves one model for thirty
    // seconds, an OpenRouter refusal may itself count against the daily cap.
    if (providerOf(model) === "openrouter") {
      if (requestsRemaining() <= 0) continue;

      // Same trade as Groq's token window below, for the same reason: a
      // per-minute refusal may be charged against the daily cap, so pausing is
      // cheaper than being told no — but only pause if the pass can afford it.
      const slot = msUntilRequestSlot();
      if (slot > 0) {
        if (Date.now() + slot >= deadline) continue;
        await new Promise((resolve) => setTimeout(resolve, slot));
      }
    }

    // Wait out the per-minute window rather than spend a request to be refused.
    // A 429 shelves the model for thirty seconds, so an avoidable refusal costs
    // far more than the pause that would have prevented it — but only wait if
    // the pass can still afford to, otherwise move to the next model.
    const wait = waitForMinuteWindow(model, batchTokenEstimate(purpose));
    if (wait > 0) {
      if (Date.now() + wait >= deadline) continue;
      await new Promise((resolve) => setTimeout(resolve, wait));
    }

    const replies = await callModel<T>(model, requestBody, deadline, purpose);
    if (replies) return replies;
  }
  return [];
}

// ── Verification ────────────────────────────────────────────────────────────
//
// The second model pass, and the only question left for a model to answer.
//
// lib/text-audit.ts has already decided everything a machine can decide by
// looking at the characters — script mixing, mojibake, truncation, preamble,
// degeneration. What it cannot decide is whether the summary says what the
// source said, and whether the translation says what the summary said. Those
// are the two questions here, and they are asked about text that has already
// passed every mechanical check, so a model is never spending a request
// grading something that was obviously broken.
//
// Asked as one batched call per ten stories, like enrichment, because the
// arithmetic only works batched: five stages over ~1,500 new stories a day is
// 7,500 calls unbatched and 750 batched, against a free tier metered per model
// per day.

const VERIFY_SYSTEM_PROMPT =
  "You are a bilingual news desk fact-checker for Nepali and English. " +
  "For each item you receive the source body, a summary written from it, and a " +
  "translation of that summary. Judge two things and nothing else.\n\n" +
  "summaryFaithful: does the summary state only what the source states? " +
  "Mark it false if it asserts a fact, number, name, date or causal claim the " +
  "source does not support, or if it reverses or overstates the source. " +
  "Do not mark it false for being shorter than the source, for omitting detail, " +
  "or for rewording. Omission is not error; invention is.\n\n" +
  "translationFaithful: does the translation carry the same meaning as the " +
  "summary, completely, in the target language? Mark it false if a clause is " +
  "dropped or added, if a number or name changes, if the meaning shifts, or if " +
  "any part was left untranslated. Do not mark it false for natural word order " +
  "or idiom differences between Nepali and English.\n\n" +
  "Respond with exactly one JSON object of the shape " +
  '{"items": [{"id", "summaryFaithful", "translationFaithful", "reason"}, ...]} ' +
  "— no markdown fences, no prose outside the object, no key besides \"items\". " +
  "Be strict: when genuinely unsure, mark false. A story held back costs a " +
  "reader nothing; a wrong one costs the publication.";

/** What verification is asked about one story. */
export interface VerifyInput {
  id: string;
  /** The source body the summary was written from. */
  source: string;
  lang: "en" | "np";
  summary: string;
  titleTranslated: string;
  summaryTranslated: string;
}

export interface VerifyVerdict {
  summaryFaithful: boolean;
  translationFaithful: boolean;
  reason?: string;
}

interface VerifyReply {
  id?: string;
  summaryFaithful?: boolean;
  translationFaithful?: boolean;
  reason?: string;
}

/**
 * Source text is truncated harder here than for enrichment.
 *
 * The judge needs enough of the article to spot an invented fact, not the whole
 * of it, and this pass has to fit alongside enrichment inside one regeneration.
 * Sending 6,000 characters per story to both stages would double the tokens for
 * a question the first 2,500 characters almost always answer.
 */
const VERIFY_SOURCE_CHARS = 2_500;

function buildVerifyBody(batch: VerifyInput[]) {
  const payload = batch.map((item) => ({
    id: item.id,
    sourceLanguage: item.lang === "np" ? "Nepali" : "English",
    targetLanguage: item.lang === "np" ? "English" : "Nepali",
    source: normalizeText(item.source).slice(0, VERIFY_SOURCE_CHARS),
    summary: normalizeText(item.summary).slice(0, 3_000),
    translation: normalizeText(
      `${item.titleTranslated}\n${item.summaryTranslated}`,
    ).slice(0, 3_000),
  }));

  return {
    messages: [
      { role: "system", content: VERIFY_SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify(payload) },
    ],
    // Lower than enrichment. This is a judgement, not a piece of writing, and
    // the same input should get the same verdict twice.
    temperature: 0,
    max_completion_tokens: MAX_OUTPUT_TOKENS,
    response_format: { type: "json_object" },
  };
}

/**
 * Check summaries and translations against their sources.
 *
 * Returns a verdict per story id. **An id absent from the result was not
 * checked**, which is not the same as failing — the budget ran out, the chain
 * was exhausted, or the model did not answer for it. Callers decide what an
 * unchecked story is worth; this function refuses to guess on their behalf.
 */
export async function verifyEnrichments(
  inputs: VerifyInput[],
  deadline: number,
): Promise<Map<string, VerifyVerdict>> {
  const verdicts = new Map<string, VerifyVerdict>();
  if (!keyFor("summary") || inputs.length === 0) return verdicts;

  const batches: VerifyInput[][] = [];
  for (let i = 0; i < inputs.length; i += BATCH_SIZE) {
    batches.push(inputs.slice(i, i + BATCH_SIZE));
  }

  // Verification spends from the same daily allowance as enrichment — both go
  // through askChain, so both are charged to the ledger — and it is the stage
  // that must give way when the two compete. A story that is translated but
  // unverified still reaches the reader and is simply marked unverified; a
  // story that was never translated does not. So the cap here is the same
  // per-pass ceiling enrichment uses, applied to what enrichment left.
  const allowed = Math.min(batches.length, MAX_BATCHES_PER_PASS);
  if (allowed < batches.length) {
    console.info(
      `[verify] ${allowed} of ${batches.length} batch(es) this pass; ` +
        "the rest stay unverified until a later pass.",
    );
  }

  let cursor = 0;
  async function worker() {
    while (cursor < allowed && Date.now() < deadline) {
      // Checked per batch, like enrichment: verification must never be the
      // stage that empties the day's allowance out from under the next pass's
      // translations.
      if (
        tokensRemaining("summary") < batchTokenEstimate("summary") &&
        !hasFallback()
      ) {
        return;
      }
      const batch = batches[cursor++];
      if (batch === undefined) return;
      const replies = await askChain<VerifyReply>(
        buildVerifyBody(batch),
        deadline,
        // Verification is a comprehension job, so it runs on the summarizer's
        // model and allowance rather than the translator's.
        "summary",
      );
      for (const reply of replies) {
        if (!reply?.id) continue;
        verdicts.set(reply.id, {
          summaryFaithful: reply.summaryFaithful !== false,
          translationFaithful: reply.translationFaithful !== false,
          reason: reply.reason,
        });
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, batches.length) }, worker),
  );
  return verdicts;
}

/** Walks the model chain until one answers. */
async function summarizeBatch(
  batch: EnrichInput[],
  deadline: number,
): Promise<ModelReply[]> {
  return askChain<ModelReply>(buildSummaryBody(batch), deadline, "summary");
}

async function translateBatch(
  batch: TranslateInput[],
  deadline: number,
): Promise<ModelReply[]> {
  return askChain<ModelReply>(
    buildTranslationBody(batch),
    deadline,
    "translation",
  );
}

/**
 * Turns one model reply into a stored result, or nothing.
 *
 * The gate is deliberately asymmetric. A summary that misses the length window
 * is still usable prose and gets kept — the window is guidance to the model, not
 * a contract with the reader. A translation in the wrong script is not usable at
 * all, so it is dropped and the UI falls back to the original.
 */
function toResult(
  summaryReply: ModelReply,
  translationReply: ModelReply | undefined,
  input: EnrichInput,
): EnrichResult | null {
  const otherLang = input.lang === "np" ? "en" : "np";

  // A verbatim item's own-language summary is the text we sent, not whatever
  // came back. Rule 9 asks the model to echo it, but asking is not enforcing —
  // this is what guarantees the publisher's words reach the reader unedited.
  const summary = input.verbatim
    ? normalizeText(input.body)
    : normalizeText(summaryReply.summary ?? "");
  if (!isInLanguage(summary, input.lang) || looksLikeBoilerplate(summary)) {
    return null;
  }

  const translatedTitle = normalizeText(translationReply?.title ?? "");
  const translatedSummary = normalizeText(translationReply?.summary ?? "");
  const translationUsable =
    isInLanguage(translatedTitle, otherLang) &&
    isInLanguage(translatedSummary, otherLang) &&
    !looksLikeBoilerplate(translatedSummary);

  // Each language is held to its own ceiling. The same 140 words is ~964
  // characters in English and ~1,060 in Nepali, so one shared number either
  // truncates the Nepali mid-thought or lets the English run a fifth long.
  return {
    summary: hardTruncateSummary(summary, summaryBounds(input.lang).max),
    titleTranslated: translationUsable ? translatedTitle : "",
    summaryTranslated: translationUsable
      ? hardTruncateSummary(translatedSummary, summaryBounds(otherLang).max)
      : "",
  };
}

/**
 * Enrich as many of `inputs` as the deadline allows.
 *
 * Stories are processed in the order given, so callers that care which ones get
 * done first — and with a metered quota every caller should — sort before
 * calling. Anything not reached is simply absent from the returned map.
 */
export async function enrichStories(
  inputs: EnrichInput[],
  deadline: number,
): Promise<Map<string, EnrichResult>> {
  const out = new Map<string, EnrichResult>();
  if (!keyFor("summary") || inputs.length === 0) return out;

  const allBatches: EnrichInput[][] = [];
  for (let i = 0; i < inputs.length; i += BATCH_SIZE) {
    allBatches.push(inputs.slice(i, i + BATCH_SIZE));
  }

  // What the day's allowance still affords, and what one pass is allowed to
  // take of it. `inputs` arrives ranked — lib/aggregator.ts sorts by score
  // before it builds the pending list — so truncating here spends the budget on
  // the stories most worth translating rather than on whichever requests won
  // the race to the API.
  // What Groq's remaining tokens afford — and, when they afford nothing, what
  // the fallback does. Without this second clause an empty Groq pool returned
  // zero batches and the chain was never walked, so the Gemini entry at the end
  // of it could not be reached on precisely the day it exists for.
  const groqAffords =
    DAILY_TOKEN_BUDGET === 0
      ? allBatches.length
      : Math.floor(
          tokensRemaining("summary") / Math.max(1, batchTokenEstimate("summary")),
        );
  const affordable =
    groqAffords > 0 ? groqAffords : hasFallback() ? allBatches.length : 0;
  const allowed = Math.max(
    0,
    Math.min(allBatches.length, MAX_BATCHES_PER_PASS, affordable),
  );

  if (allowed === 0) {
    console.warn(
      `[enrich] skipped ${allBatches.length} batch(es): ${tokensRemaining("summary").toLocaleString()} tokens left ` +
        `of a ${DAILY_TOKEN_BUDGET.toLocaleString()} daily budget. Stories keep their publisher text.`,
    );
    return out;
  }
  if (allowed < allBatches.length) {
    console.info(
      `[enrich] ${allowed} of ${allBatches.length} batch(es) this pass ` +
        `(${tokensRemaining("summary").toLocaleString()} tokens left today); the rest keep publisher text ` +
        "and are picked up by a later pass.",
    );
  }

  const batches = allBatches.slice(0, allowed);
  let cursor = 0;

  async function worker() {
    while (true) {
      if (Date.now() >= deadline) return;
      // Re-checked per batch, not only up front: a batch that came back dearer
      // than expected must not let the two still in flight overdraw the day.
      if (
        tokensRemaining("summary") < batchTokenEstimate("summary") &&
        !hasFallback()
      ) {
        return;
      }
      const index = cursor++;
      if (index >= batches.length) return;

      const batch = batches[index];
      if (batch === undefined) return;
      const byId = new Map(batch.map((item) => [item.id, item]));

      // ── Stage one: the summary, in the story's own language ───────────────
      let summaries: ModelReply[];
      try {
        summaries = await summarizeBatch(batch, deadline);
      } catch (err) {
        console.warn("[summary] batch failed:", err);
        continue;
      }

      // Match on the echoed id, falling back to position. Models are reliable
      // about the id but not universally, and a batch answered in order with a
      // mangled id is still four good summaries.
      const paired = summaries
        .map((reply, position) => ({
          reply,
          input: (reply.id ? byId.get(reply.id) : undefined) ?? batch[position],
        }))
        .filter(
          (pair): pair is { reply: ModelReply; input: EnrichInput } =>
            pair.input !== undefined && !out.has(pair.input.id),
        );

      // ── Stage two: the translation, made from that summary ────────────────
      //
      // The translator never sees the source. It is handed the finished
      // paragraph and nothing else, so the two language versions cannot drift
      // apart: the second is made from the first rather than written beside it.
      //
      // Its own key and its own allowance, so a day spent summarizing does not
      // leave translation with nothing. A verbatim item still goes through
      // here — its own-language text is the publisher's, but the translation
      // is ours to write.
      const translatable: TranslateInput[] = paired
        .map(({ reply, input }) => ({
          id: input.id,
          title: normalizeText(reply.title ?? input.title),
          summary: input.verbatim
            ? normalizeText(input.body)
            : normalizeText(reply.summary ?? ""),
          from: input.lang,
        }))
        .filter((item) => item.summary.length > 0);

      const translations = new Map<string, ModelReply>();
      if (
        translatable.length > 0 &&
        (tokensRemaining("translation") >= batchTokenEstimate("translation") ||
          hasFallback())
      ) {
        try {
          const replies = await translateBatch(translatable, deadline);
          replies.forEach((reply, position) => {
            const id = reply.id ?? translatable[position]?.id;
            if (id) translations.set(id, reply);
          });
        } catch (err) {
          // A failed translation is not a failed story: the summary still
          // stands and the UI falls back to the original language.
          console.warn("[translation] batch failed:", err);
        }
      }

      for (const { reply, input } of paired) {
        const result = toResult(reply, translations.get(input.id), input);
        if (result) out.set(input.id, result);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, batches.length) }, worker),
  );

  return out;
}
