// lib/enrich/translate.ts
// DB-backed translation pipeline.
// Picks up pending translation jobs from the `translations` table,
// calls the best available provider (Groq → Google → MyMemory),
// and saves results back to the DB.
//
// The existing lib/translator.ts handles the actual provider calls.
// This layer adds DB persistence, status tracking, and queue processing.

import sql from "@/lib/db";
import { batchTranslateToNepali, translateToNepali } from "@/lib/translator";

const BATCH_SIZE = 20;
const MAX_ITEMS_PER_PUMP = 50;

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

  // Claim a batch of pending translations atomically
  const pending = await sql<
    Array<{
      id: string;
      articleId: string;
      lang: string;
      title: string | null;
      summary: string | null;
    }>
  >`
    select
      t.id,
      t.article_id,
      t.lang,
      a.title_original   as title,
      a.summary_original as summary
    from translations t
    join articles a on a.id = t.article_id
    where t.status = 'pending'
      and t.lang = 'np'
    order by t.created_at asc
    limit ${MAX_ITEMS_PER_PUMP}
  `;

  if (pending.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0, durationMs: 0 };
  }

  // Mark them as in-progress to avoid double-processing in concurrent runs
  const ids = pending.map((r) => r.id);
  await sql`
    update translations
    set status = 'pending', updated_at = now()
    where id = any(${ids})
  `;

  let succeeded = 0;
  let failed = 0;

  // Process in batches for efficiency
  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);

    const titles = batch.map((r) => r.title ?? "");
    const summaries = batch.map((r) => r.summary ?? "");

    try {
      const translatedTitles = await batchTranslateToNepali(titles);
      const translatedSummaries = await batchTranslateToNepali(summaries);

      for (let j = 0; j < batch.length; j++) {
        const row = batch[j];
        await sql`
          update translations
          set
            translated_title   = ${translatedTitles[j] || null},
            translated_summary = ${translatedSummaries[j] || null},
            provider           = 'groq',
            status             = 'ok',
            updated_at         = now()
          where id = ${row.id}
        `;
        succeeded++;
      }
    } catch (batchErr) {
      // Fall back to per-item translation on batch failure
      for (const row of batch) {
        try {
          const translatedTitle = row.title
            ? await translateToNepali(row.title)
            : null;
          const translatedSummary = row.summary
            ? await translateToNepali(row.summary)
            : null;

          await sql`
            update translations
            set
              translated_title   = ${translatedTitle},
              translated_summary = ${translatedSummary},
              provider           = 'fallback',
              status             = 'ok',
              updated_at         = now()
            where id = ${row.id}
          `;
          succeeded++;
        } catch (itemErr) {
          await sql`
            update translations
            set
              status     = 'error',
              updated_at = now()
            where id = ${row.id}
          `;
          failed++;
        }
      }
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
