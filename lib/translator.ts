// lib/translator.ts
// Translation pipeline: Groq LLM → Google → MyMemory.
// Server-only. Azure and LibreTranslate removed.
// Translation results are cached in-memory for the lifetime of the serverless
// function instance. Disk writes are intentionally avoided — Vercel's runtime
// filesystem is read-only after deployment.

const GOOGLE_API_KEY = process.env.GOOGLE_TRANSLATE_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
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

/**
 * Translate up to ~15 texts in a single Groq API call using JSON output.
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
          content: `Translate each numbered English line to Nepali. Return a JSON object with a "translations" key containing an array of Nepali strings, one per input line in order. Example:\nInput:\n1. Hello\n2. World\nOutput:\n{"translations": ["नमस्ते", "संसार"]}`,
        },
        { role: "user", content: numbered },
      ],
      temperature: 0.1,
      max_tokens: 4096,
      response_format: { type: "json_object" },
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

  const parsed = JSON.parse(content);
  const arr: unknown[] = Array.isArray(parsed)
    ? parsed
    : (parsed.translations ?? parsed.results ?? Object.values(parsed)[0]);

  if (!Array.isArray(arr) || arr.length !== texts.length) {
    throw new Error(
      `Groq batch: expected ${texts.length} translations, got ${Array.isArray(arr) ? arr.length : "non-array"}`,
    );
  }

  return arr.map(String);
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

// ── Groq Summarization ────────────────────────────────────────────────────────

/**
 * Summarize text into a tight, detail-rich news brief using Groq.
 * Target: 1–2 short paragraphs, ~40–80 words total.
 * Falls back to original text if Groq is unavailable.
 */
export async function groqSummarize(text: string): Promise<string> {
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
          content:
            "You are a news editor. Condense the article into 1 or 2 short paragraphs (40–80 words total). Include only the most important facts: who, what, when, where, and why. Use a neutral, newspaper tone. Pack maximum information into minimum words. Separate paragraphs with a blank line. No labels, numbering, or markdown.",
        },
        { role: "user", content: text },
      ],
      temperature: 0.15,
      max_tokens: 300,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (res.status === 429) {
    blockGroq();
    return text;
  }
  if (!res.ok) return text;

  const data = await res.json();
  const summary = data?.choices?.[0]?.message?.content?.trim() ?? "";
  return summary || text;
}
