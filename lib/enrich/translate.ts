// lib/enrich/translate.ts
// DB-backed enrichment pipeline.
//
// Each pending `translations` row represents a request to translate the
// article into `translations.lang` (which is the OPPOSITE of the article's
// source language). For each one, we:
//   1. Generate a short brief in the article's ORIGINAL language → `rewrites`
//      (style='brief').
//   2. Generate a full faithful translation into `translations.lang` →
//      `translations.translated_title` + `translations.translated_summary`.
//
// Sized for Groq free tier on meta-llama/llama-4-scout-17b-16e-instruct:
//   30 RPM / 1K RPD / 30K TPM / 500K TPD.
// Each article costs ~2 Groq requests and ~4.2K tokens (summarize + full
// translate). At 1 item per run × 15-min cadence = 96 runs/day:
//   ~192 RPD (19%), ~403K TPD (81%), peak TPM ~4.2K (14%).

import sql from "@/lib/db";
import {
  groqFullTranslate,
  groqSummarize,
  translateToNepali,
} from "@/lib/translator";

const MAX_ITEMS_PER_PUMP = 1;

function isDbAvailable(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export interface TranslationPumpResult {
  processed: number;
  succeeded: number;
  failed: number;
  durationMs: number;
}

/**
 * Process a batch of pending translations from the DB.
 * Called by POST /api/admin/enrich/pump.
 */
export async function pumpTranslations(): Promise<TranslationPumpResult> {
  if (!isDbAvailable()) {
    return { processed: 0, succeeded: 0, failed: 0, durationMs: 0 };
  }

  const startedAt = Date.now();

  // Claim pending translations (any lang). Joined with the source article to
  // get the original title, summary, and language in a single query.
  const pending = await sql<
    Array<{
      id: string;
      articleId: string;
      lang: "en" | "np";
      sourceLang: "en" | "np" | "multi";
      title: string | null;
      summary: string | null;
    }>
  >`
    select
      t.id,
      t.article_id,
      t.lang,
      a.language         as source_lang,
      a.title_original   as title,
      a.summary_original as summary
    from translations t
    join articles a on a.id = t.article_id
    where t.status = 'pending'
      and t.lang in ('en', 'np')
    order by t.created_at asc
    limit ${MAX_ITEMS_PER_PUMP}
  `;

  if (pending.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0, durationMs: 0 };
  }

  let succeeded = 0;
  let failed = 0;

  for (const row of pending) {
    const targetLang = row.lang;
    const sourceLang: "en" | "np" =
      row.sourceLang === "np" ? "np" : "en"; // normalize 'multi' → 'en'
    const originalTitle = row.title ?? "";
    const originalSummary = row.summary ?? "";

    try {
      // 1. Brief in the ORIGINAL language → rewrites table.
      if (originalSummary) {
        try {
          const brief = await groqSummarize(originalSummary, sourceLang);
          if (brief && brief !== originalSummary) {
            await sql`
              insert into rewrites (article_id, lang, style, title, summary, provider)
              values (
                ${row.articleId},
                ${sourceLang},
                'brief',
                ${originalTitle || null},
                ${brief},
                'groq'
              )
              on conflict (article_id, lang, style)
              do update set
                summary    = excluded.summary,
                provider   = excluded.provider,
                updated_at = now()
            `;
          }
        } catch (err) {
          console.warn(
            `[enrich] brief failed for ${row.articleId}:`,
            (err as Error).message,
          );
        }
      }

      // 2. Full faithful translation into the TARGET language → translations.
      let translatedTitle: string | null = null;
      let translatedSummary: string | null = null;
      let provider: string = "groq";

      if (originalSummary) {
        translatedSummary = await groqFullTranslate(originalSummary, targetLang);
      }

      if (originalTitle) {
        // Title is short — prefer the dedicated cascade (Groq first, Google
        // fallback) for speed. Only available EN→NP today.
        if (targetLang === "np") {
          translatedTitle = (await translateToNepali(originalTitle)) || null;
        } else {
          // NP→EN title: reuse the full-translate helper.
          translatedTitle = (await groqFullTranslate(originalTitle, "en")) || null;
        }
      }

      if (!translatedSummary && !translatedTitle) {
        provider = "fallback";
      }

      await sql`
        update translations
        set
          translated_title   = ${translatedTitle || null},
          translated_summary = ${translatedSummary || null},
          provider           = ${provider},
          status             = ${translatedSummary || translatedTitle ? "ok" : "error"},
          updated_at         = now()
        where id = ${row.id}
      `;

      if (translatedSummary || translatedTitle) {
        succeeded++;
      } else {
        failed++;
      }
    } catch (err) {
      console.warn(
        `[enrich] translation failed for ${row.articleId}:`,
        (err as Error).message,
      );
      await sql`
        update translations
        set status = 'error', updated_at = now()
        where id = ${row.id}
      `.catch(() => {});
      failed++;
    }
  }

  return {
    processed: pending.length,
    succeeded,
    failed,
    durationMs: Date.now() - startedAt,
  };
}

/**
 * Get or create a Nepali translation for a single article (title + summary).
 * Returns null if no translation is available yet (pending / error).
 */
export async function getTranslationForArticle(
  articleId: string,
): Promise<{ title: string | null; summary: string | null } | null> {
  if (!isDbAvailable()) return null;

  const rows = await sql<
    Array<{ translatedTitle: string | null; translatedSummary: string | null }>
  >`
    select translated_title, translated_summary
    from translations
    where article_id = ${articleId}
      and lang = 'np'
      and status = 'ok'
    limit 1
  `;

  if (rows.length === 0) return null;
  return {
    title: rows[0].translatedTitle,
    summary: rows[0].translatedSummary,
  };
}
