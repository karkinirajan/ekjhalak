// lib/translator.ts
// Translation pipeline: Groq LLM → Google → MyMemory.
// Server-only. Azure and LibreTranslate removed.
// Translation results are cached in-memory for the lifetime of the serverless
// function instance. Disk writes are intentionally avoided — Vercel's runtime
// filesystem is read-only after deployment.

const GOOGLE_API_KEY = process.env.GOOGLE_TRANSLATE_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
// Llama 4 Scout — 30K TPM / 500K TPD on Groq free tier (2.5× / 5× the headroom
// of llama-3.3-70b-versatile) and stronger multilingual fidelity for Nepali.
const GROQ_MODEL =
  process.env.GROQ_MODEL ?? "meta-llama/llama-4-scout-17b-16e-instruct";
const MYMEMORY_EMAIL = process.env.MYMEMORY_EMAIL ?? "";

const MYMEMORY_REQUEST_GAP_MS = 1_500;
const MYMEMORY_COOLDOWN_MS = 30 * 60 * 1_000;
const GROQ_COOLDOWN_MS = 2 * 60 * 1_000; // short — Groq rate limits reset fast

// In-memory cache: survives across requests within the same function instance.
const translationCache = new Map<string, string>();
const inFlight = new Map<string, Promise<string>>();

let myMemoryQueue: Promise<void> = Promise.resolve();
let myMemoryBlockedUntil = 0;
let hasLoggedMyMemoryCooldown = false;
let groqBlockedUntil = 0;

// ── Google Translate ──────────────────────────────────────────────────────────

async function googleTranslate(text: string): Promise<string> {
  const res = await fetch(
    `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        q: text,
        source: "en",
        target: "ne",
        format: "text",
      }),
      signal: AbortSignal.timeout(10_000),
    },
  );

  if (!res.ok) throw new Error(`Google Translate HTTP ${res.status}`);

  const data = await res.json();
  const translated = data?.data?.translations?.[0]?.translatedText ?? "";
  if (!translated) throw new Error("Google Translate: empty response");
  return translated;
}

// ── Groq LLM Translation ─────────────────────────────────────────────────────

function isGroqCoolingDown() {
  return groqBlockedUntil > Date.now();
}

function blockGroq() {
  groqBlockedUntil = Date.now() + GROQ_COOLDOWN_MS;
  console.warn("[translator] Groq rate limited; cooling down for 2 minutes");
}

async function groqTranslate(text: string): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        {
          role: "system",
          content:
            "Translate the English text to Nepali. Output ONLY the Nepali translation, no explanation.",
        },
        { role: "user", content: text },
      ],
      temperature: 0.1,
      max_tokens: 2048,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (res.status === 429) {
    blockGroq();
    throw new Error("Groq HTTP 429: rate limited");
  }
  if (!res.ok) throw new Error(`Groq HTTP ${res.status}`);

  const data = await res.json();
  const translated = data?.choices?.[0]?.message?.content?.trim() ?? "";
  if (!translated) throw new Error("Groq: empty response");
  return translated;
}

function parseNumberedBatchOutput(content: string, expected: number): string[] {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  // Fast path: exactly one non-empty line per input.
  if (lines.length === expected) {
    return lines.map((line) => line.replace(/^\d+\s*[).:-]?\s*/, "").trim());
  }

  const translations: string[] = new Array(expected).fill("");
  let currentIndex = -1;

  for (const rawLine of lines) {
    const match = rawLine.match(/^(\d+)\s*[).:-]?\s*(.*)$/);
    if (match) {
      const idx = Number(match[1]) - 1;
      if (idx >= 0 && idx < expected) {
        currentIndex = idx;
        translations[idx] = match[2].trim();
      }
      continue;
    }

    if (currentIndex >= 0 && currentIndex < expected) {
      translations[currentIndex] =
        `${translations[currentIndex]} ${rawLine}`.trim();
    }
  }

  const filled = translations.filter(Boolean).length;
  if (filled !== expected) {
    throw new Error(
      `Groq batch: expected ${expected} translations, got ${filled}`,
    );
  }

  return translations;
}

/**
 * Translate up to ~15 texts in a single Groq API call using numbered-line output.
 * Returns an array of Nepali strings in the same order as input.
 */
async function groqBatchTranslate(texts: string[]): Promise<string[]> {
  const numbered = texts.map((t, i) => `${i + 1}. ${t}`).join("\n");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        {
          role: "system",
          content:
            "Translate each numbered English line to Nepali. Return ONLY numbered Nepali lines in the exact same order as input (one line per item). No JSON, no markdown, no extra commentary.",
        },
        { role: "user", content: numbered },
      ],
      temperature: 0.1,
      max_tokens: 4096,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (res.status === 429) {
    blockGroq();
    throw new Error("Groq HTTP 429: rate limited");
  }
  if (!res.ok) throw new Error(`Groq HTTP ${res.status}`);

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content?.trim() ?? "";
  if (!content) throw new Error("Groq batch: empty response");

  return parseNumberedBatchOutput(content, texts.length);
}

// ── Sentence splitting (for MyMemory 500-char limit) ─────────────────────────

function splitSentences(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];

  const sentences = text.split(/(?<=[.!?।])\s+/).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if ((current + " " + sentence).trim().length <= maxLen) {
      current = current ? `${current} ${sentence}` : sentence;
      continue;
    }
    if (current) chunks.push(current.trim());
    if (sentence.length > maxLen) {
      let remainder = sentence;
      while (remainder.length > maxLen) {
        chunks.push(remainder.slice(0, maxLen).trim());
        remainder = remainder.slice(maxLen).trim();
      }
      current = remainder;
    } else {
      current = sentence;
    }
  }

  if (current) chunks.push(current.trim());
  return chunks.filter(Boolean);
}

// ── MyMemory (free, rate-limited) ─────────────────────────────────────────────

function isMyMemoryCoolingDown() {
  return myMemoryBlockedUntil > Date.now();
}

function blockMyMemory() {
  myMemoryBlockedUntil = Date.now() + MYMEMORY_COOLDOWN_MS;
  if (!hasLoggedMyMemoryCooldown) {
    hasLoggedMyMemoryCooldown = true;
    console.warn(
      "[translator] MyMemory rate limited; skipping translation for 30 minutes",
    );
  }
}

async function myMemoryFetchChunk(chunk: string): Promise<string> {
  if (isMyMemoryCoolingDown()) return "";

  return new Promise<string>((resolve, reject) => {
    myMemoryQueue = myMemoryQueue
      .catch(() => {
        // Keep the queue alive after a failed request.
      })
      .then(async () => {
        if (isMyMemoryCoolingDown()) {
          resolve("");
          return;
        }

        await new Promise((done) => setTimeout(done, MYMEMORY_REQUEST_GAP_MS));

        try {
          const params = new URLSearchParams({
            q: chunk,
            langpair: "en|ne",
            ...(MYMEMORY_EMAIL ? { de: MYMEMORY_EMAIL } : {}),
          });

          const res = await fetch(
            `https://api.mymemory.translated.net/get?${params}`,
            { signal: AbortSignal.timeout(15_000) },
          );

          if (res.status === 429) {
            blockMyMemory();
            resolve("");
            return;
          }

          if (!res.ok) throw new Error(`MyMemory HTTP ${res.status}`);

          const data = await res.json();
          if (data.responseStatus !== 200) {
            const details = String(data.responseDetails ?? "unknown error");
            if (/quota|rate limit|too many/i.test(details)) {
              blockMyMemory();
              resolve("");
              return;
            }
            throw new Error(`MyMemory: ${details}`);
          }

          resolve(data?.responseData?.translatedText ?? "");
        } catch (error) {
          reject(error);
        }
      });
  });
}

async function myMemoryTranslate(text: string): Promise<string> {
  const chunks = splitSentences(text, 500);
  const parts: string[] = [];

  for (const chunk of chunks) {
    const translated = await myMemoryFetchChunk(chunk);
    if (!translated && isMyMemoryCoolingDown()) return "";
    parts.push(translated);
  }

  return parts.join(" ").trim();
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function translateToNepali(text: string): Promise<string> {
  const key = text.trim();
  if (!key) return "";

  const cached = translationCache.get(key);
  if (cached !== undefined) return cached;

  const existing = inFlight.get(key);
  if (existing) return existing;

  const persist = (value: string) => {
    if (value) {
      translationCache.set(key, value);
    }
    inFlight.delete(key);
    return value;
  };

  const promise = (async () => {
    try {
      if (GROQ_API_KEY && !isGroqCoolingDown())
        return persist(await groqTranslate(key));
      if (GOOGLE_API_KEY) return persist(await googleTranslate(key));
      if (isMyMemoryCoolingDown()) return persist("");
      return persist(await myMemoryTranslate(key));
    } catch (error) {
      const message = (error as Error).message;
      console.warn("[translator]", message);
      if (/Groq HTTP 429/i.test(message)) {
        blockGroq();
      }

      try {
        if (GOOGLE_API_KEY) return persist(await googleTranslate(key));
        if (!isMyMemoryCoolingDown()) {
          return persist(await myMemoryTranslate(key));
        }
      } catch (fallbackError) {
        console.warn("[translator]", (fallbackError as Error).message);
      }

      inFlight.delete(key);
      return "";
    }
  })();

  inFlight.set(key, promise);
  return promise;
}

export async function batchTranslateToNepali(
  texts: string[],
  concurrency = 1,
): Promise<string[]> {
  // 1. Try Groq LLM batch — translate ~15 texts per API call
  if (GROQ_API_KEY && !isGroqCoolingDown()) {
    const GROQ_CHUNK = 15;
    const GROQ_CHUNK_DELAY = 2_200; // ~27 req/min, under 30 limit
    // Hard budget: Vercel static-generation pages timeout after 60s.
    // Leave a safe margin so we return partial results rather than killing the build.
    const GROQ_BUDGET_MS = 45_000;
    const groqDeadline = Date.now() + GROQ_BUDGET_MS;
    const results: string[] = new Array(texts.length).fill("");
    try {
      for (let i = 0; i < texts.length; i += GROQ_CHUNK) {
        if (Date.now() > groqDeadline) {
          console.warn(
            `[translator] Groq budget exceeded — returning ${i}/${texts.length} translations`,
          );
          return results; // return whatever completed before the deadline
        }
        if (i > 0) await new Promise((r) => setTimeout(r, GROQ_CHUNK_DELAY));
        const chunk = texts.slice(i, i + GROQ_CHUNK);
        const translated = await groqBatchTranslate(chunk);
        translated.forEach((t, j) => {
          results[i + j] = t;
          if (t) translationCache.set(texts[i + j].trim(), t);
        });
      }
      return results;
    } catch (error) {
      const message = (error as Error).message;
      console.warn("[translator]", message);
      if (/Groq HTTP 429/i.test(message)) blockGroq();
    }
  }

  // 2. Groq is unavailable. Skip translation if only MyMemory is available.
  //    MyMemory enforces a 1.5s gap per request — for batches of 50+ items
  //    (typical at build time) this easily exceeds Vercel's 60-second
  //    static-generation timeout and kills the build.
  if (!GOOGLE_API_KEY) {
    console.warn(
      `[translator] No fast provider available for batch of ${texts.length} — skipping translation`,
    );
    return new Array(texts.length).fill("");
  }

  // 3. Fall back to individual translation cascade.
  // Apply a hard time budget (30s) — if we're still going after that, return
  // whatever translated so far. This caps worst-case build time regardless of
  // which providers respond slowly.
  const FALLBACK_BUDGET_MS = 30_000;
  const deadline = Date.now() + FALLBACK_BUDGET_MS;
  const results: string[] = new Array(texts.length).fill("");

  for (let i = 0; i < texts.length; i += concurrency) {
    if (Date.now() > deadline) {
      console.warn(
        `[translator] Fallback budget exceeded — translated ${i}/${texts.length} items`,
      );
      break;
    }

    const batchIndices = Array.from(
      { length: Math.min(concurrency, texts.length - i) },
      (_, offset) => i + offset,
    );

    const batchResults = await Promise.all(
      batchIndices.map((index) => translateToNepali(texts[index])),
    );

    batchIndices.forEach((index, offset) => {
      results[index] = batchResults[offset];
    });
  }

  return results;
}

// ── Paragraph-boundary clamp (no mid-sentence cutoffs) ───────────────────────

const SUMMARY_TARGET_MIN = 680;
export const SUMMARY_TARGET_MAX = 1100;

/**
 * Trim a multi-paragraph text so it ends on a complete sentence / paragraph.
 * Only removes trailing paragraphs that would push length past `hardMax`.
 * Never cuts mid-sentence.
 */
function clampToParagraphs(text: string, hardMax: number): string {
  const cleaned = text.trim();
  if (cleaned.length <= hardMax) return cleaned;

  const paragraphs = cleaned
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const kept: string[] = [];
  let total = 0;
  for (const p of paragraphs) {
    const next = total + (kept.length ? 2 : 0) + p.length;
    if (next > hardMax && kept.length > 0) break;
    kept.push(p);
    total = next;
  }
  return kept.join("\n\n");
}

/** Clamp summary text to the same hard limit used by Groq summary output. */
export function clampSummaryToMax(text: string): string {
  return clampToParagraphs(text, SUMMARY_TARGET_MAX);
}

// ── Groq Summarization (language-aware) ──────────────────────────────────────

const SUMMARY_SYSTEM_EN =
  `You are a news editor. Write a 3-paragraph news brief in English (120–180 words, 680–950 chars). ` +
  `Include who/what/when/where/why, key figures, dates, and outcomes. ` +
  `Every sentence must be complete — never end mid-sentence. Separate paragraphs with a blank line. ` +
  `Neutral newspaper tone. No labels, headings, numbering, or markdown.`;

const SUMMARY_SYSTEM_NP =
  `तपाईं नेपाली समाचार सम्पादक हुनुहुन्छ। नेपाली भाषामा ३ अनुच्छेदको समाचार सार लेख्नुहोस् (लगभग १२०–१८० शब्द, ६८०–९५० अक्षर)। ` +
  `मुख्य तथ्य, मिति, आंकडा, र परिणाम समावेश गर्नुहोस्। प्रत्येक वाक्य पूर्ण हुनुपर्छ — कहिल्यै बीचमा नकाट्नुहोस्। ` +
  `अनुच्छेद बीचमा खाली लाइन राख्नुहोस्। तटस्थ समाचार शैली। कुनै शीर्षक, क्रम, वा markdown नराख्नुहोस्।`;

/**
 * Summarize text in the given language. Produces a 3-paragraph brief in
 * `lang` with complete sentences and no mid-sentence cutoffs.
 */
export async function groqSummarize(
  text: string,
  lang: "en" | "np" = "en",
): Promise<string> {
  if (!GROQ_API_KEY || isGroqCoolingDown()) return text;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        {
          role: "system",
          content: lang === "np" ? SUMMARY_SYSTEM_NP : SUMMARY_SYSTEM_EN,
        },
        { role: "user", content: text },
      ],
      temperature: 0.15,
      // Devanagari tokenizes ~3× English. 1500 tokens fits ~180 NP words.
      max_tokens: lang === "np" ? 1500 : 700,
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (res.status === 429) {
    blockGroq();
    return text;
  }
  if (!res.ok) return text;

  const data = await res.json();
  const summary = data?.choices?.[0]?.message?.content?.trim() ?? "";
  if (!summary) return text;

  const clamped = clampSummaryToMax(summary);
  // Short summaries are acceptable; only fall back if Groq returned nothing.
  return clamped.length >= SUMMARY_TARGET_MIN || clamped.length > 0
    ? clamped
    : text;
}

// ── Groq Full Translation (NP ↔ EN, preserves paragraph structure) ───────────

/**
 * Translate a full article to the target language while preserving paragraph
 * breaks. Unlike `translateToNepali` (short lines), this is tuned for longer
 * news bodies — does not compress, does not split sentences across paragraphs.
 */
export async function groqFullTranslate(
  text: string,
  target: "en" | "np",
): Promise<string> {
  if (!GROQ_API_KEY || isGroqCoolingDown()) return "";

  const direction =
    target === "np"
      ? "Translate the following English news article to Nepali."
      : "Translate the following Nepali news article to English.";

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        {
          role: "system",
          content:
            `${direction} Preserve paragraph breaks (blank line between paragraphs). ` +
            `Translate faithfully — do not summarize, shorten, or add commentary. ` +
            `Every sentence must be complete. Output ONLY the translation.`,
        },
        { role: "user", content: text },
      ],
      temperature: 0.1,
      max_tokens: target === "np" ? 2200 : 1100,
    }),
    signal: AbortSignal.timeout(25_000),
  });

  if (res.status === 429) {
    blockGroq();
    return "";
  }
  if (!res.ok) return "";

  const data = await res.json();
  const translated = data?.choices?.[0]?.message?.content?.trim() ?? "";
  return translated;
}
