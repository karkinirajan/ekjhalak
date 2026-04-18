// lib/summarizer.ts
// Single-responsibility: produce a concise, original-language news summary via Groq.
// No translation is performed here or anywhere else in the pipeline — the
// article's language is preserved from source through to display.

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL =
  process.env.GROQ_MODEL ?? "meta-llama/llama-4-scout-17b-16e-instruct";
const GROQ_COOLDOWN_MS = 2 * 60 * 1_000;

let groqBlockedUntil = 0;

function isGroqCoolingDown() {
  return groqBlockedUntil > Date.now();
}

function blockGroq() {
  groqBlockedUntil = Date.now() + GROQ_COOLDOWN_MS;
}

export const SUMMARY_MAX_CHARS = 480;
export const SUMMARY_MIN_CHARS = 160;

function normalizeText(text: string): string {
  return text
    .trim()
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ");
}

export function isSummaryAcceptable(text: string): boolean {
  const cleaned = normalizeText(text);
  return (
    cleaned.length >= SUMMARY_MIN_CHARS && cleaned.length <= SUMMARY_MAX_CHARS
  );
}

/**
 * Hard cap a summary to `max` chars, snapping to the nearest sentence
 * terminator (. ! ? or Devanagari ।) when one is reasonably close to the
 * cut, otherwise breaking on a word boundary and appending an ellipsis.
 * Used as the last-line-of-defense when the LLM cannot satisfy the bound.
 */
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
  const safeSlice = lastSpace > Math.floor(max * 0.5) ? slice.slice(0, lastSpace) : slice;
  return `${safeSlice.trim().replace(/[,;:\-–—]+$/, "")}…`;
}

const SYSTEM_EN =
  `You are a precise news editor. Rewrite the source into one clean English summary. ` +
  `Hard length bound: output MUST be between ${SUMMARY_MIN_CHARS} and ${SUMMARY_MAX_CHARS} characters — aim for the shortest length that still delivers the full idea. ` +
  `Cover the who, what, when, where, and outcome. Use only facts from the source; never invent names, numbers, or quotes. ` +
  `Every sentence must be complete and self-contained — never end mid-thought. ` +
  `Neutral newsroom tone. One paragraph. No labels, headings, lists, or markdown.`;

const SYSTEM_NP =
  `तपाईं अनुभवी नेपाली समाचार सम्पादक हुनुहुन्छ। स्रोतबाट एक सफा नेपाली सारांश लेख्नुहोस्। ` +
  `कडा नियम: सारांशको लम्बाइ ${SUMMARY_MIN_CHARS} देखि ${SUMMARY_MAX_CHARS} अक्षर भित्र अनिवार्य हो — सकेसम्म छोटो राख्नुहोस् तर पूर्ण अर्थ दिनुहोस्। ` +
  `को, के, कहिले, कहाँ र के भयो — मुख्य तथ्य, मिति, आंकडा समावेश गर्नुहोस्। स्रोतमा नभएको कुरा कहिल्यै नलेख्नुहोस्। ` +
  `प्रत्येक वाक्य पूर्ण हुनुपर्छ, कहीँ पनि बीचमा नकाट्नुहोस्। तटस्थ समाचार शैली। एउटा अनुच्छेद। शीर्षक, क्रम वा markdown नराख्नुहोस्।`;

async function callGroq(
  text: string,
  lang: "en" | "np",
  retryHint?: string,
): Promise<string> {
  const system = lang === "np" ? SYSTEM_NP : SYSTEM_EN;
  const user = retryHint
    ? `Rewrite so the final output is strictly between ${SUMMARY_MIN_CHARS} and ${SUMMARY_MAX_CHARS} characters with complete sentences:\n\n${retryHint}`
    : text;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.15,
      max_tokens: lang === "np" ? 700 : 380,
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (res.status === 429) {
    blockGroq();
    return "";
  }
  if (!res.ok) return "";

  const data = await res.json();
  return normalizeText(data?.choices?.[0]?.message?.content?.trim() ?? "");
}

/**
 * Produce a short brief in the article's original language.
 * Returns "" when the model cannot satisfy the length bound — callers fall back
 * to the raw source summary rather than showing a malformed brief.
 */
export async function summarize(
  text: string,
  lang: "en" | "np" = "en",
): Promise<string> {
  const source = normalizeText(text);
  if (!source) return "";

  if (!GROQ_API_KEY || isGroqCoolingDown()) {
    return isSummaryAcceptable(source) ? source : "";
  }

  let candidate = await callGroq(source, lang);
  if (isSummaryAcceptable(candidate)) return candidate;

  for (let i = 0; i < 2; i++) {
    candidate = await callGroq(source, lang, candidate || source);
    if (isSummaryAcceptable(candidate)) return candidate;
  }

  return "";
}
