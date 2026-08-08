// lib/enrich-apply.ts
// Taking a model's answer and deciding whether a reader may see it.
//
// Moved out of lib/aggregator.ts because there are now two callers, not one: the
// enrichment stage that runs on the request path, and the scheduled drain in
// app/api/enrich/route.ts that works through the archive without a reader
// waiting. They must apply *identical* rules — a story enriched by the drain and
// a story enriched by a pass have to be the same kind of story, or the publish
// gate is grading against two different standards and `quality.audited` stops
// meaning one thing.
//
// Pure and free of `server-only` on purpose: this is text going in and text
// coming out, which is the part worth testing.

import { decodeEntities, htmlToText } from "./html-entities";
import type { NewsItem } from "./news-pipeline";
import type { EnrichResult } from "./summarizer";
import {
  auditStoryText,
  auditText,
  formatFindings,
  type AuditResult,
  type TextLang,
} from "./text-audit";

/** Decode first so escaped markup is revealed, then strip what it revealed. */
export function cleanModelText(text: string): string {
  if (!text) return "";
  return htmlToText(decodeEntities(text));
}

/**
 * One line per rejection, sampled rather than exhaustive.
 *
 * A model having a bad minute can fail hundreds of items in one pass, and a log
 * line each turns a signal into a wall. The counter is what tells you whether
 * this is one odd story or the whole batch.
 */
let rejectionCount = 0;
const REJECTION_LOG_LIMIT = 12;

function rejected(item: NewsItem, stage: string, verdict: AuditResult): void {
  rejectionCount++;
  if (rejectionCount <= REJECTION_LOG_LIMIT) {
    console.warn(
      `[audit] dropped ${stage} for ${item.sourceName} — ${formatFindings(verdict)}`,
    );
  } else if (rejectionCount === REJECTION_LOG_LIMIT + 1) {
    console.warn("[audit] further rejections suppressed for this process");
  }
}

/**
 * Model output is not trusted text.
 *
 * The feed parser and the article extractor both clean what they read, but
 * whatever the model returns went straight into the item — and the model is
 * summarising HTML-derived prose, so it echoes what it was shown. A live feed
 * had `&nbsp;` sitting inside an NDTV summary that no publisher had put there.
 *
 * Cleaned here rather than only at render, so the API payload and anything that
 * ever reads it are clean too.
 */
export function applyEnrichment(item: NewsItem, result: EnrichResult): void {
  const originalLang = item.originalLang;
  const otherLang: TextLang = originalLang === "np" ? "en" : "np";

  // ── The original language ─────────────────────────────────────────────────
  //
  // A rewrite that fails the audit is discarded rather than shown. The
  // publisher's own text is already sitting in `item.summary`, and it is always
  // the safer of the two: whatever is wrong with it, it is not half Devanagari
  // and it does not start by saying "Here is the summary:".
  const rewritten = cleanModelText(result.summary);
  if (rewritten) {
    const verdict = auditText(rewritten, {
      lang: originalLang,
      title: item.title,
    });
    if (verdict.ok) {
      item.summary = rewritten;
      item.quality = { ...(item.quality ?? { bilingual: false }), audited: true };
    } else {
      rejected(item, `summary/${originalLang}`, verdict);
    }
  }

  // ── The translation ───────────────────────────────────────────────────────
  //
  // Here there is no fallback, and that is the point. A missing translation is
  // handled everywhere in the UI — the reader sees the story in its original
  // language, which is honest. A *broken* translation is rendered as though it
  // were real, and a Nepali reader gets a paragraph of English with three
  // Devanagari words in it. Absent beats wrong.
  const title = cleanModelText(result.titleTranslated ?? "");
  const summary = cleanModelText(result.summaryTranslated ?? "");

  if (title && summary) {
    const verdict = auditStoryText({ title, summary }, otherLang);
    if (verdict.ok) {
      item.titleTranslated = title;
      item.summaryTranslated = summary;
      item.quality = { ...(item.quality ?? {}), audited: true, bilingual: true };
    } else {
      rejected(item, `translation/${otherLang}`, verdict);
    }
  } else if (title || summary) {
    // Half a translation is not a translation. Rendering a translated headline
    // over an untranslated body reads as a bug to anyone who can read both.
    rejected(item, `translation/${otherLang}`, {
      ok: false,
      findings: [
        {
          code: "empty",
          severity: "fatal",
          detail: title ? "headline without body" : "body without headline",
        },
      ],
    });
  }
}
