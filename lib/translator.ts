import fs from "fs";
import path from "path";

const CACHE_FILE = path.join(process.cwd(), ".translation-cache.json");

function loadDiskCache(): Map<string, string> {
  try {
    const raw = fs.readFileSync(CACHE_FILE, "utf8");
    const parsed = JSON.parse(raw) as Record<string, string>;
    return new Map(Object.entries(parsed));
  } catch {
    return new Map();
  }
}

function saveDiskCache(cache: Map<string, string>) {
  try {
    fs.writeFileSync(
      CACHE_FILE,
      JSON.stringify(Object.fromEntries(cache), null, 2),
      "utf8",
    );
  } catch {
    // Best-effort cache persistence only.
  }
}

const translationCache = loadDiskCache();
const inFlight = new Map<string, Promise<string>>();

const GOOGLE_API_KEY = process.env.GOOGLE_TRANSLATE_API_KEY;
const LIBRE_URL = process.env.LIBRETRANSLATE_API_URL;
const LIBRE_KEY = process.env.LIBRETRANSLATE_API_KEY ?? "";
const MYMEMORY_EMAIL = process.env.MYMEMORY_EMAIL ?? "";

const MYMEMORY_REQUEST_GAP_MS = 1_500;
const MYMEMORY_COOLDOWN_MS = 30 * 60 * 1_000;

let myMemoryQueue: Promise<void> = Promise.resolve();
let myMemoryBlockedUntil = 0;
let hasLoggedMyMemoryCooldown = false;

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

async function libreTranslate(text: string): Promise<string> {
  const res = await fetch(`${LIBRE_URL}/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      q: text,
      source: "en",
      target: "ne",
      api_key: LIBRE_KEY,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) throw new Error(`LibreTranslate HTTP ${res.status}`);

  const data = await res.json();
  const translated = data?.translatedText ?? "";
  if (!translated) throw new Error("LibreTranslate: empty response");
  return translated;
}

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

function isMyMemoryCoolingDown() {
  return myMemoryBlockedUntil > Date.now();
}

function blockMyMemory() {
  myMemoryBlockedUntil = Date.now() + MYMEMORY_COOLDOWN_MS;
  if (!hasLoggedMyMemoryCooldown) {
    hasLoggedMyMemoryCooldown = true;
    console.warn(
      "[translator] MyMemory rate limited; skipping remote translation requests for 30 minutes",
    );
  }
}

async function myMemoryFetchChunk(chunk: string): Promise<string> {
  if (isMyMemoryCoolingDown()) {
    return "";
  }

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

          if (!res.ok) {
            throw new Error(`MyMemory HTTP ${res.status}`);
          }

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
    if (!translated && isMyMemoryCoolingDown()) {
      return "";
    }
    parts.push(translated);
  }

  return parts.join(" ").trim();
}

export async function translateToNepali(text: string): Promise<string> {
  const key = text.trim();
  if (!key) return "";

  const cached = translationCache.get(key);
  if (cached !== undefined) return cached;

  const existing = inFlight.get(key);
  if (existing) return existing;

  const persist = (value: string) => {
    translationCache.set(key, value);
    inFlight.delete(key);
    if (value) {
      saveDiskCache(translationCache);
    }
    return value;
  };

  const promise = (async () => {
    try {
      if (GOOGLE_API_KEY) return persist(await googleTranslate(key));
      if (LIBRE_URL) return persist(await libreTranslate(key));
      if (isMyMemoryCoolingDown()) return persist("");
      return persist(await myMemoryTranslate(key));
    } catch (error) {
      console.warn("[translator]", (error as Error).message);
      inFlight.delete(key);
      translationCache.set(key, "");
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
