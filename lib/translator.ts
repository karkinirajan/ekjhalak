// lib/translator.ts
// Translation pipeline: Azure Translator → Google → fast free
// LibreTranslate-compatible endpoints → MyMemory (last fallback). Server-only.
// Translation results are cached in-memory for the lifetime of the serverless
// function instance. Disk writes are intentionally avoided — Vercel's runtime
// filesystem is read-only after deployment.

import {
  isAzureTranslatorConfigured,
  translateManyWithAzure,
  translateWithAzure,
} from "./azure-translator";

const GOOGLE_API_KEY = process.env.GOOGLE_TRANSLATE_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
const LIBRE_KEY = process.env.LIBRETRANSLATE_API_KEY ?? "";
const MYMEMORY_EMAIL = process.env.MYMEMORY_EMAIL ?? "";

const LIBRE_TIMEOUT_MS = 4_500;
const LIBRE_COOLDOWN_MS = 10 * 60 * 1_000;
const MYMEMORY_REQUEST_GAP_MS = 1_500;
const MYMEMORY_COOLDOWN_MS = 30 * 60 * 1_000;
const AZURE_COOLDOWN_MS = 15 * 60 * 1_000;
const GROQ_COOLDOWN_MS = 2 * 60 * 1_000; // short — Groq rate limits reset fast

const LIBRE_ENDPOINTS = [
  process.env.LIBRETRANSLATE_API_URL,
  // Public LibreTranslate-compatible endpoints. These are free-first defaults,
  // not production guarantees. Configure LIBRETRANSLATE_API_URL for stability.
  "https://libretranslate.com",
  "https://translate.argosopentech.com",
].filter((value, index, array): value is string => {
  return Boolean(value) && array.indexOf(value) === index;
});

// In-memory cache: survives across requests within the same function instance.
const translationCache = new Map<string, string>();
const inFlight = new Map<string, Promise<string>>();

let myMemoryQueue: Promise<void> = Promise.resolve();
let myMemoryBlockedUntil = 0;
let hasLoggedMyMemoryCooldown = false;
let azureBlockedUntil = 0;
let groqBlockedUntil = 0;
const libreBlockedUntilByUrl = new Map<string, number>();

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

async function azureTranslate(text: string): Promise<string> {
  const result = await translateWithAzure({
    text,
    from: "en",
    to: "ne",
  });
  return result.translations[0]?.text ?? "";
}

function isAzureCoolingDown() {
  return azureBlockedUntil > Date.now();
}

function blockAzure() {
  azureBlockedUntil = Date.now() + AZURE_COOLDOWN_MS;
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

// ── LibreTranslate ────────────────────────────────────────────────────────────

function isLibreCoolingDown(endpoint: string) {
  return (libreBlockedUntilByUrl.get(endpoint) ?? 0) > Date.now();
}

function blockLibre(endpoint: string) {
  libreBlockedUntilByUrl.set(endpoint, Date.now() + LIBRE_COOLDOWN_MS);
}

async function libreTranslateVia(
  endpoint: string,
  text: string,
): Promise<string> {
  const res = await fetch(`${endpoint.replace(/\/$/, "")}/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      q: text,
      source: "en",
      target: "ne",
      ...(LIBRE_KEY ? { api_key: LIBRE_KEY } : {}),
    }),
    signal: AbortSignal.timeout(LIBRE_TIMEOUT_MS),
  });

  if (res.status === 429 || res.status >= 500) {
    blockLibre(endpoint);
    throw new Error(`LibreTranslate HTTP ${res.status}`);
  }

  if (!res.ok) throw new Error(`LibreTranslate HTTP ${res.status}`);

  const data = await res.json();
  const translated = data?.translatedText ?? "";
  if (!translated) throw new Error("LibreTranslate: empty response");
  return translated;
}

async function libreTranslate(text: string): Promise<string> {
  let lastError: Error | null = null;

  for (const endpoint of LIBRE_ENDPOINTS) {
    if (isLibreCoolingDown(endpoint)) continue;

    try {
      return await libreTranslateVia(endpoint, text);
    } catch (error) {
      lastError = error as Error;
      if (
        lastError.name === "TimeoutError" ||
        /fetch failed|ENOTFOUND|EAI_AGAIN|ECONNRESET|timeout/i.test(
          lastError.message,
        )
      ) {
        blockLibre(endpoint);
      }
    }
  }

  throw lastError ?? new Error("LibreTranslate: no endpoints configured");
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
      if (isAzureTranslatorConfigured() && !isAzureCoolingDown())
        return persist(await azureTranslate(key));
      if (GROQ_API_KEY && !isGroqCoolingDown())
        return persist(await groqTranslate(key));
      if (GOOGLE_API_KEY) return persist(await googleTranslate(key));
      if (LIBRE_ENDPOINTS.length > 0) return persist(await libreTranslate(key));
      if (isMyMemoryCoolingDown()) return persist("");
      return persist(await myMemoryTranslate(key));
    } catch (error) {
      const message = (error as Error).message;
      console.warn("[translator]", message);
      if (
        /Azure Translator HTTP 401|Azure Translator HTTP 403|Azure Translator HTTP 429/i.test(
          message,
        )
      ) {
        blockAzure();
      }
      if (/Groq HTTP 429/i.test(message)) {
        blockGroq();
      }

      try {
        if (GROQ_API_KEY && !isGroqCoolingDown())
          return persist(await groqTranslate(key));
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
  // 1. Try Azure batch API
  if (isAzureTranslatorConfigured() && !isAzureCoolingDown()) {
    try {
      const result = await translateManyWithAzure({
        texts,
        from: "en",
        to: "ne",
      });

      return texts.map(
        (_, index) => result.translations[index]?.[0]?.text?.trim() ?? "",
      );
    } catch (error) {
      const message = (error as Error).message;
      console.warn("[translator]", message);
      if (
        /Azure Translator HTTP 401|Azure Translator HTTP 403|Azure Translator HTTP 429/i.test(
          message,
        )
      ) {
        blockAzure();
      }
    }
  }

  // 2. Try Groq LLM batch — translate ~15 texts per API call
  if (GROQ_API_KEY && !isGroqCoolingDown()) {
    const GROQ_CHUNK = 15;
    const GROQ_CHUNK_DELAY = 2_200; // ~27 req/min, under 30 limit
    const results: string[] = new Array(texts.length).fill("");
    try {
      for (let i = 0; i < texts.length; i += GROQ_CHUNK) {
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

  // 3. Fall back to individual translation cascade
  const results: string[] = new Array(texts.length).fill("");

  for (let i = 0; i < texts.length; i += concurrency) {
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
