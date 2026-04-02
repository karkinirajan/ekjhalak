// lib/enrich/rewrite.ts
// DB-backed rewrite pipeline using LLM summarisation.
// Generates 'brief' and 'readable' rewrites and stores them in the rewrites table.

import sql from "@/lib/db";
import {
  briefRewriteSystemPrompt,
  readableRewriteSystemPrompt,
} from "@/lib/enrich/prompts";

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = "llama-3.3-70b-versatile";

async function groqRewrite(
  systemPrompt: string,
  userContent: string,
): Promise<string> {
  if (!GROQ_API_KEY) return "";
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        temperature: 0.15,
        max_tokens: 400,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return "";
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return data.choices?.[0]?.message?.content ?? "";
  } catch {
    return "";
  }
}

function isDbAvailable(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export interface RewriteResult {
  title: string | null;
  summary: string | null;
  style: "brief" | "readable";
  lang: "en" | "np";
  fromDb: boolean;
}

/**
 * Get or generate a rewrite for an article.
 * Returns cached DB result if available; otherwise generates and stores.
 */
export async function getOrCreateRewrite(
  articleId: string,
  style: "brief" | "readable",
  lang: "en" | "np",
  sourceTitle: string,
  sourceSummary: string,
): Promise<RewriteResult> {
  const base: Omit<RewriteResult, "fromDb"> = {
    title: null,
    summary: null,
    style,
    lang,
  };

  if (!isDbAvailable()) {
    return { ...base, fromDb: false };
  }

  // Check cache
  const cached = await sql<
    Array<{ title: string | null; summary: string | null }>
  >`
    select title, summary
    from rewrites
    where article_id = ${articleId}
      and lang = ${lang}
      and style = ${style}
    limit 1
  `;

  if (cached.length > 0) {
    return {
      title: cached[0].title,
      summary: cached[0].summary,
      style,
      lang,
      fromDb: true,
    };
  }

  // Generate via LLM
  const systemPrompt =
    style === "brief"
      ? briefRewriteSystemPrompt(lang)
      : readableRewriteSystemPrompt(lang);

  const userContent = `Title: ${sourceTitle}\nSummary: ${sourceSummary}`;

  try {
    const raw = await groqRewrite(systemPrompt, userContent);
    let parsed: { title?: string; summary?: string } = {};

    try {
      parsed = JSON.parse(raw);
    } catch {
      // If JSON parse fails, use raw as summary
      parsed = { title: sourceTitle, summary: raw };
    }

    const title = parsed.title ?? sourceTitle;
    const summary = parsed.summary ?? sourceSummary;

    await sql`
      insert into rewrites (article_id, lang, style, title, summary, provider)
      values (${articleId}, ${lang}, ${style}, ${title}, ${summary}, 'groq')
      on conflict (article_id, lang, style) do update
        set title = excluded.title, summary = excluded.summary, updated_at = now()
    `;

    return { title, summary, style, lang, fromDb: false };
  } catch (_err) {
    return { ...base, fromDb: false };
  }
}
