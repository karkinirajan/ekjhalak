// lib/story-text.ts
// Which version of a story the reader is shown.
//
// Every component that renders a headline or a summary goes through here, so the
// language toggle means one thing everywhere and the fallback behaves the same
// on a card, in the rail and inside the reader panel.

import type { NewsItem, OriginalLang } from "./news-pipeline";
import type { Lang } from "./i18n";

export interface StoryText {
  title: string;
  summary: string;
  /**
   * The language actually being rendered — which is not always the one the
   * reader asked for. Drives both the `lang` attribute and the Devanagari font
   * class, so a story falling back to its original still gets typeset correctly
   * rather than set in a Latin face.
   */
  lang: OriginalLang;
  /** True when the reader is looking at a machine translation, not the source. */
  translated: boolean;
}

/**
 * The story in the reader's language, or the closest honest thing to it.
 *
 * Falls back to the original whenever a translation is missing — a story the
 * enrichment pass has not reached yet, or one where the model answered in the
 * wrong script and the summarizer rejected it. Showing the source language is
 * the right failure: the reader gets real news they may have to work slightly
 * harder at, rather than an empty card or a fabricated translation.
 */
export function storyText(item: NewsItem, language: Lang): StoryText {
  const original: StoryText = {
    title: item.title,
    summary: item.summary,
    lang: item.originalLang,
    translated: false,
  };

  if (language === item.originalLang) return original;

  const title = item.titleTranslated?.trim();
  if (!title) return original;

  return {
    title,
    summary: item.summaryTranslated?.trim() ?? "",
    lang: language,
    translated: true,
  };
}

/** The `lang` attribute value for a rendered story language. */
export function langAttr(lang: OriginalLang): string {
  return lang === "np" ? "ne" : "en";
}
