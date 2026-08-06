// lib/summarizer.ts
// Bilingual enrichment against the Gemini API. Server-only.
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
const BATCH_SIZE = clampInt(process.env.GEMINI_BATCH_SIZE, 10, 1, 40);
/** Requests in flight at once. */
const CONCURRENCY = clampInt(process.env.GEMINI_CONCURRENCY, 3, 1, 8);
const REQUEST_TIMEOUT_MS = 45_000;

/**
 * Models tried in order, first to answer wins.
 *
 * This list is a quota strategy, not indecision. Gemini's free tier meters
 * `GenerateRequestsPerDayPerProjectPerModel` — per *model* — so five models is
 * five separate daily allowances rather than one. Measured on this project's own
 * key: gemini-3.6-flash allows 20 requests/day and gemini-2.0-flash allows 0.
 * Twenty requests would enrich two hundred stories a day; the chain plus the
 * batch size above is what turns that into a number a live feed can live on.
 *
 * GEMINI_MODEL still wins — set it to a single name to pin one model, or to a
 * comma-separated list to replace the chain outright. Whatever it names is tried
 * first and the defaults follow as fallbacks.
 *
 * Ordered cheapest-and-fastest first. The lite models do not spend tokens on
 * thinking, which for a rewrite-and-translate task buys nothing and costs the
 * entire output budget — see MAX_OUTPUT_TOKENS.
 */
const DEFAULT_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-3.6-flash",
];

/**
 * Deliberately far above what the answer needs (~300 tokens per story per
 * language).
 *
 * The thinking models bill their reasoning against this same ceiling and spend
 * it first. The previous setting of 380 was consumed entirely by 361 thinking
 * tokens on gemini-3.6-flash: every response came back `finishReason:
 * MAX_TOKENS` holding a 61-character fragment, was rejected as too short,
 * retried twice into the same wall, and the whole feed silently fell through to
 * hard truncation. A ceiling this high cannot be reached by thinking on a task
 * this small, so it works whether or not the configured model reasons.
 */
const MAX_OUTPUT_TOKENS = 32_000;

const API_KEY = process.env.GEMINI_API_KEY;

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
  const configured = (process.env.GEMINI_MODEL ?? "")
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
// A 429 means one model is out, not that Gemini is down, so the cooldown is
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
 * Google reports two different exhaustions through the same status code. A
 * per-minute limit clears on its own in under a minute and the response says so
 * in `retryDelay`. A per-day limit does not clear until the quota resets, and
 * retrying it every minute for the rest of the day is pure noise — so those get
 * a much longer shelf regardless of what retryDelay claims.
 */
function cooldownFor(body: unknown): number {
  const raw = JSON.stringify(body ?? "");
  if (/PerDay|per_day|RequestsPerDay/i.test(raw)) return DAILY_QUOTA_COOLDOWN_MS;

  const match = raw.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  const seconds = match ? Number.parseFloat(match[1]) : NaN;
  return Number.isFinite(seconds)
    ? Math.max(MIN_COOLDOWN_MS, seconds * 1_000)
    : MIN_COOLDOWN_MS;
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
  `12. Return one object per input item, in the same order, echoing the item's id exactly.`;

/**
 * Structured output, so parsing is a `JSON.parse` rather than a set of
 * heuristics over prose. Gemini validates against this before answering, which
 * is also what stops a model dropping one of the four fields on a hard item.
 */
const RESPONSE_SCHEMA = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      id: { type: "STRING" },
      titleEn: { type: "STRING" },
      summaryEn: { type: "STRING" },
      titleNp: { type: "STRING" },
      summaryNp: { type: "STRING" },
    },
    required: ["id", "titleEn", "summaryEn", "titleNp", "summaryNp"],
  },
} as const;

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
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ parts: [{ text: JSON.stringify(payload) }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    },
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

async function callModel(
  model: string,
  batch: EnrichInput[],
  deadline: number,
): Promise<ModelReply[] | null> {
  let res: Response;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": API_KEY as string,
        },
        body: JSON.stringify(buildRequestBody(batch)),
        signal: AbortSignal.timeout(requestTimeout(deadline)),
      },
    );
  } catch {
    // Timeout or transport failure. Shelve briefly so a flapping model does not
    // eat the whole run's deadline batch after batch.
    coolDown(model, MIN_COOLDOWN_MS);
    return null;
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    if (res.status === 429 || res.status === 503) {
      coolDown(model, cooldownFor(detail));
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
  const candidate = data?.candidates?.[0];
  if (!candidate) return null;

  // A truncated answer is not a partial answer: the JSON will not parse, and the
  // stories in this batch are better served by the next model than by salvage.
  if (candidate.finishReason && candidate.finishReason !== "STOP") {
    console.warn(`[enrich] ${model} stopped early: ${candidate.finishReason}`);
    return null;
  }

  const text = (candidate.content?.parts ?? [])
    .map((part: { text?: string }) => part.text ?? "")
    .join("")
    .trim();
  if (!text) return null;

  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? (parsed as ModelReply[]) : null;
  } catch {
    return null;
  }
}

/** Walks the model chain until one answers. */
async function enrichBatch(
  batch: EnrichInput[],
  deadline: number,
): Promise<ModelReply[]> {
  for (const model of modelChain()) {
    if (isCoolingDown(model)) continue;
    // Walking the chain is itself work: five models that each take their turn
    // timing out would spend five request timeouts on one batch. Stop at the
    // deadline and let the caller keep what it already had.
    if (Date.now() >= deadline) break;
    const replies = await callModel(model, batch, deadline);
    if (replies) return replies;
  }
  return [];
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
