"use client";

import { Newspaper } from "lucide-react";
import { SourceMark, TopicPill } from "@/components/topic-pill";
import { useFeedClock } from "@/components/feed-clock";
import { useTheme } from "@/components/theme-provider";
import {
  cn,
  formatRelativeTime,
  sanitizeTextForDisplay,
  truncate,
} from "@/lib/utils";
import type { NewsItem } from "@/lib/news-pipeline";

export type StoryVariant = "lead" | "side" | "grid" | "compact";

interface StoryCardProps {
  item: NewsItem;
  variant?: StoryVariant;
  onOpen: (item: NewsItem) => void;
  /** Rank number, shown by the compact variant in the trending rail */
  rank?: number;
}

const SUMMARY_CHARS: Record<StoryVariant, number> = {
  lead: 240,
  side: 180,
  grid: 220,
  compact: 0,
};

/**
 * One story, in four editorial weights.
 *
 *   lead    — dominant hero: full-bleed photo, headline reversed out over it
 *   side    — hero's supporting stack: small thumbnail beside the headline
 *   grid    — the standard feed card: photo above, headline and standfirst below
 *   compact — ranked text row for the trending rail
 *
 * All four share one interaction model: the whole card opens the brief, and the
 * headline is the accessible name of that control.
 */
export function StoryCard({
  item,
  variant = "grid",
  onOpen,
  rank,
}: StoryCardProps) {
  const { t, language } = useTheme();
  const now = useFeedClock();

  const isNp = item.originalLang === "np";
  const langAttr = isNp ? "ne" : "en";
  const title = sanitizeTextForDisplay(item.title);
  const summaryChars = SUMMARY_CHARS[variant];
  const summary = summaryChars
    ? truncate(sanitizeTextForDisplay(item.summary), summaryChars)
    : "";
  const relative = formatRelativeTime(item.publishedTimestamp, language, now);

  if (variant === "lead") {
    return (
      <article
        data-topic={item.topic}
        className="group relative border-l border-transparent py-3 pl-0 transition-all duration-200 hover:border-[var(--topic)] hover:bg-raised/40"
      >
        <div className="flex flex-wrap items-center gap-2 text-[0.72rem] uppercase tracking-[0.2em] text-ink-muted">
          <TopicPill topic={item.topic} lang={language} tone="quiet" />
          {item.coverageCount > 1 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-rule px-2.5 py-1 text-ink-muted">
              <Newspaper className="h-3 w-3" aria-hidden="true" />
              {item.coverageCount} {t.outletsMany}
            </span>
          )}
        </div>

        <h2
          lang={langAttr}
          className={cn(
            "mt-4 text-[clamp(1.7rem,3.4vw,2.4rem)] font-semibold leading-[1.08] tracking-[-0.025em] text-ink",
            isNp ? "font-np" : "font-display",
          )}
        >
          <button
            type="button"
            onClick={() => onOpen(item)}
            className="card-focus text-left"
          >
            {title}
          </button>
        </h2>

        {summary && (
          <p
            lang={langAttr}
            className={cn(
              "mt-3 max-w-[64ch] text-[1rem] leading-[1.75] text-ink-soft",
              isNp && "font-np",
            )}
          >
            {summary}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-[0.8rem] uppercase tracking-[0.16em] text-ink-muted">
          <SourceMark name={item.sourceName} className="min-w-0" />
          <span aria-hidden="true" className="h-3 w-px bg-rule" />
          <span>{relative}</span>
        </div>
      </article>
    );
  }

  if (variant === "side") {
    return (
      <article
        data-topic={item.topic}
        className="group relative border-l border-transparent py-3 pl-4 transition-all duration-200 hover:border-[var(--topic)] hover:bg-raised/40"
      >
        <div className="flex flex-wrap items-center gap-2">
          <TopicPill topic={item.topic} lang={language} tone="quiet" />
          <span className="eyebrow text-ink-muted">{relative}</span>
        </div>
        <h3
          lang={langAttr}
          className={cn(
            "mt-2 text-[1.05rem] font-semibold leading-[1.3] tracking-[-0.015em] text-ink",
            isNp ? "font-np" : "font-display",
          )}
        >
          <button
            type="button"
            onClick={() => onOpen(item)}
            className="card-focus text-left"
          >
            {title}
          </button>
        </h3>
        {summary && (
          <p
            className={cn(
              "mt-2 text-[0.95rem] leading-[1.7] text-ink-soft",
              isNp && "font-np",
            )}
          >
            {summary}
          </p>
        )}
      </article>
    );
  }

  if (variant === "compact") {
    return (
      <article data-topic={item.topic} className="group flex gap-3.5 py-1">
        <span
          aria-hidden="true"
          className="font-display text-2xl leading-none font-semibold text-ink-muted transition-colors group-hover:text-[var(--topic)]"
        >
          {String(rank ?? 0).padStart(2, "0")}
        </span>

        <div className="min-w-0 flex-1">
          <h3
            lang={langAttr}
            className={cn(
              "text-sm font-semibold leading-snug text-ink transition-colors group-hover:text-[var(--topic)]",
              isNp && "font-np",
            )}
          >
            <button
              type="button"
              onClick={() => onOpen(item)}
              className="card-focus text-left"
            >
              {title}
            </button>
          </h3>
          <p className="mt-1.5 eyebrow flex flex-wrap items-center gap-x-2 text-ink-muted">
            <span className="truncate">{item.sourceName}</span>
            {item.coverageCount > 1 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-[var(--topic)]">
                  {item.coverageCount} {t.outletsMany}
                </span>
              </>
            )}
          </p>
        </div>
      </article>
    );
  }

  return (
    <article
      data-topic={item.topic}
      className="group relative border-l border-transparent py-3 pl-4 transition-all duration-200 hover:border-[var(--topic)] hover:bg-raised/40"
    >
      <div className="flex flex-wrap items-center gap-2">
        <TopicPill topic={item.topic} lang={language} tone="quiet" />
        <span className="eyebrow text-ink-muted">{relative}</span>
      </div>

      <h3
        lang={langAttr}
        className={cn(
          "mt-2 text-[1.13rem] font-semibold leading-[1.25] tracking-[-0.015em] text-ink",
          isNp ? "font-np" : "font-display",
        )}
      >
        <button
          type="button"
          onClick={() => onOpen(item)}
          className="card-focus text-left"
        >
          {title}
        </button>
      </h3>

      {summary && (
        <p
          lang={langAttr}
          className={cn(
            "mt-2 max-w-[64ch] text-[0.95rem] leading-[1.7] text-ink-soft",
            isNp && "font-np",
          )}
        >
          {summary}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[0.8rem] uppercase tracking-[0.16em] text-ink-muted">
        <SourceMark name={item.sourceName} className="min-w-0" />
        {item.coverageCount > 1 && (
          <span className="inline-flex items-center gap-1.5">
            <Newspaper className="h-3 w-3" aria-hidden="true" />
            {item.coverageCount} {t.outletsMany}
          </span>
        )}
      </div>
    </article>
  );
}
