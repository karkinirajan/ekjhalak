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

export const SUMMARY_MAX_CHARS = 1_760;
export const SUMMARY_MIN_CHARS = 300;

/**
 * How much publisher-written text is kept unrewritten.
 *
 * When a newsroom's own og:description is fuller than the blurb its feed
 * shipped, that text *is* the summary — it was written by the desk that
 * reported the story, and putting a model between the reader and it can only
 * lose something. So it is shown as it stands, up to three times the old
 * ceiling, and only text longer than this is handed to the model to compress.
 */
export const VERBATIM_MAX_CHARS = 2_640;

/** Stories per request. */
const BATCH_SIZE = clampInt(process.env.GROQ_BATCH_SIZE, 10, 1, 40);
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
const DEFAULT_MODELS = ["openai/gpt-oss-120b"];

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
const MAX_OUTPUT_TOKENS = 32_000;

const API_KEY = process.env.GROQ_API_KEY;
const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

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

function modelChain(): string[] {
  const configured = (process.env.GROQ_MODEL ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  return [...new Set([...configured, ...DEFAULT_MODELS])];
}

// ── Text hygiene ────────────────────────────────────────────────────────────

function normalizeText(text: string): string {
  return text
    .trim()
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ");
}

const BOILERPLATE =
  /unlock these with subscription|subscription benefits|already a subscriber|to continue reading|sign up (?:to|for) (?:our|the)|all rights reserved/i;

export function looksLikeBoilerplate(text: string): boolean {
  return BOILERPLATE.test(text);
}

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
    const seconds = Number.parseFloat(match[2]);
    return Math.max(MIN_COOLDOWN_MS, (minutes * 60 + seconds) * 1_000);
  }

  return MIN_COOLDOWN_MS;
}

// ── Prompt ──────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT =
  `You are the bilingual desk of a Nepali newsroom. You receive a JSON array of source items. ` +
  `For every item, produce the story twice: once in English and once in Nepali (Devanagari script). ` +
  `Each version needs a headline and one summary paragraph.\n\n` +
  `Rules, all of them binding:\n` +
  `1. Length: aim for ${SUMMARY_MIN_CHARS}–${SUMMARY_MAX_CHARS} characters. Use the length the story earns — a wire brief with one fact stays short, a story with several threads uses the room. Never pad to reach a number and never stop before the story is told.\n` +
  `2. Completeness is the priority. Carry every load-bearing fact across: who acted, what they did, when and where, the numbers, the stated reason, who is affected, what happens next, and any reaction or denial the source records. A summary that reports the event but drops the consequence has failed.\n` +
  `3. Precision over compression. Keep every name, title, place, date, figure, currency amount and unit exactly as the source gives it — never round, convert, approximate or re-date. Preserve the source's own hedging: "alleged" stays alleged, "reportedly" stays reportedly, an accusation never becomes a finding, a proposal never becomes a decision.\n` +
  `4. Attribute claims to whoever made them. "The minister said X" must not become "X". If the source names who is speaking, so must you.\n` +
  `5. Use only what the source says. Never add background, context, explanation or consequence that is not in the text in front of you, however obvious it seems.\n` +
  `6. The two language versions must state the same facts in the same order. The Nepali is a translation of the story, not a different story, and the same holds in reverse. Neither may contain a fact the other lacks.\n` +
  `7. Write natural, idiomatic Nepali — the register of a printed Nepali daily. Do not transliterate English sentences into Devanagari. Transliterate proper nouns and organisation names the way Nepali papers do. Use Devanagari digits only where the source does.\n` +
  `8. Every sentence must be complete and self-contained. Never end mid-thought or trail off into an ellipsis.\n` +
  `9. Neutral newsroom tone. One paragraph. No headings, labels, lists, markdown, emoji or first person.\n` +
  `10. Strip publisher chrome: subscription pitches, "read more", bylines, datelines, copyright lines, section tags, navigation words.\n` +
  `11. An item marked "verbatim": true must have its summary in the source language reproduced EXACTLY as supplied, character for character, with no rewriting, trimming or reordering. Only the other language is yours to write. This is the publisher's own text and it is not to be improved.\n` +
  `12. Respond with exactly one JSON object of the shape {"items": [{"id", "titleEn", "summaryEn", "titleNp", "summaryNp"}, ...]} — one entry per input item, in the same order, echoing the item's id exactly. No markdown fences, no prose outside the object, no key besides "items".`;

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

interface ModelReply {
  id?: string;
  titleEn?: string;
  summaryEn?: string;
  titleNp?: string;
  summaryNp?: string;
}

export function isEnrichmentConfigured(): boolean {
  return Boolean(API_KEY);
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

function buildRequestBody(batch: EnrichInput[]) {
  const payload = batch.map((item) => ({
    id: item.id,
    sourceLanguage: item.lang === "np" ? "Nepali" : "English",
    headline: normalizeText(item.title).slice(0, 400),
    body: normalizeText(item.body).slice(0, MAX_SOURCE_CHARS),
    ...(item.verbatim ? { verbatim: true } : {}),
  }));

  return {
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
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

async function callModel<T>(
  model: string,
  requestBody: Record<string, unknown>,
  deadline: number,
): Promise<T[] | null> {
  let res: Response;
  try {
    res = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({ ...requestBody, model }),
      signal: AbortSignal.timeout(requestTimeout(deadline)),
    });
  } catch {
    // Timeout or transport failure. Shelve briefly so a flapping model does not
    // eat the whole run's deadline batch after batch.
    coolDown(model, MIN_COOLDOWN_MS);
    return null;
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    if (res.status === 429 || res.status === 503) {
      coolDown(model, cooldownFor(res, detail));
    } else if (res.status === 400 || res.status === 404) {
      // Bad model name or a request shape this model rejects — never going to
      // work, so take it out of the chain for this process.
      coolDown(model, 24 * 60 * 60 * 1_000);
      console.warn(`[enrich] ${model} rejected the request: ${detail.slice(0, 200)}`);
    } else {
      coolDown(model, MIN_COOLDOWN_MS);
    }
    return null;
  }

  const data = await res.json().catch(() => null);
  const choice = data?.choices?.[0];
  if (!choice) return null;

  // A truncated answer is not a partial answer: the JSON will not parse, and the
  // stories in this batch are better served by the next model than by salvage.
  if (choice.finish_reason && choice.finish_reason !== "stop") {
    console.warn(`[enrich] ${model} stopped early: ${choice.finish_reason}`);
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
async function askChain<T>(
  requestBody: Record<string, unknown>,
  deadline: number,
): Promise<T[]> {
  for (const model of modelChain()) {
    if (isCoolingDown(model)) continue;
    if (Date.now() >= deadline) break;
    const replies = await callModel<T>(model, requestBody, deadline);
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
  if (!API_KEY || inputs.length === 0) return verdicts;

  const batches: VerifyInput[][] = [];
  for (let i = 0; i < inputs.length; i += BATCH_SIZE) {
    batches.push(inputs.slice(i, i + BATCH_SIZE));
  }

  let cursor = 0;
  async function worker() {
    while (cursor < batches.length && Date.now() < deadline) {
      const batch = batches[cursor++];
      const replies = await askChain<VerifyReply>(
        buildVerifyBody(batch),
        deadline,
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
async function enrichBatch(
  batch: EnrichInput[],
  deadline: number,
): Promise<ModelReply[]> {
  return askChain<ModelReply>(buildRequestBody(batch), deadline);
}

/**
 * Turns one model reply into a stored result, or nothing.
 *
 * The gate is deliberately asymmetric. A summary that misses the length window
 * is still usable prose and gets kept — the window is guidance to the model, not
 * a contract with the reader. A translation in the wrong script is not usable at
 * all, so it is dropped and the UI falls back to the original.
 */
function toResult(reply: ModelReply, input: EnrichInput): EnrichResult | null {
  const otherLang = input.lang === "np" ? "en" : "np";

  // A verbatim item's own-language summary is the text we sent, not whatever
  // came back. Rule 11 asks the model to echo it, but asking is not enforcing —
  // this is what guarantees the publisher's words reach the reader unedited.
  const summary = input.verbatim
    ? normalizeText(input.body)
    : normalizeText((input.lang === "np" ? reply.summaryNp : reply.summaryEn) ?? "");
  if (!isInLanguage(summary, input.lang) || looksLikeBoilerplate(summary)) {
    return null;
  }

  const translatedTitle = normalizeText(
    (input.lang === "np" ? reply.titleEn : reply.titleNp) ?? "",
  );
  const translatedSummary = normalizeText(
    (input.lang === "np" ? reply.summaryEn : reply.summaryNp) ?? "",
  );
  const translationUsable =
    isInLanguage(translatedTitle, otherLang) &&
    isInLanguage(translatedSummary, otherLang) &&
    !looksLikeBoilerplate(translatedSummary);

  const ceiling = input.verbatim ? VERBATIM_MAX_CHARS : SUMMARY_MAX_CHARS;
  return {
    summary: hardTruncateSummary(summary, ceiling),
    titleTranslated: translationUsable ? translatedTitle : "",
    summaryTranslated: translationUsable
      ? hardTruncateSummary(translatedSummary, ceiling)
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
  if (!API_KEY || inputs.length === 0) return out;

  const batches: EnrichInput[][] = [];
  for (let i = 0; i < inputs.length; i += BATCH_SIZE) {
    batches.push(inputs.slice(i, i + BATCH_SIZE));
  }

  let cursor = 0;

  async function worker() {
    while (true) {
      if (Date.now() >= deadline) return;
      const index = cursor++;
      if (index >= batches.length) return;

      const batch = batches[index];
      const byId = new Map(batch.map((item) => [item.id, item]));

      let replies: ModelReply[];
      try {
        replies = await enrichBatch(batch, deadline);
      } catch (err) {
        console.warn("[enrich] batch failed:", err);
        continue;
      }

      // Match on the echoed id, falling back to position. Models are reliable
      // about the id but not universally, and a batch answered in order with a
      // mangled id is still four good summaries.
      replies.forEach((reply, position) => {
        const input =
          (reply.id ? byId.get(reply.id) : undefined) ?? batch[position];
        if (!input || out.has(input.id)) return;
        const result = toResult(reply, input);
        if (result) out.set(input.id, result);
      });
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, batches.length) }, worker),
  );

  return out;
}
