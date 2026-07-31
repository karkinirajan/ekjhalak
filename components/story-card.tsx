"use client";

import { Newspaper } from "lucide-react";
import { StoryImage } from "@/components/story-image";
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
  lead: 220,
  side: 0,
  grid: 150,
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

  // ── Lead ─────────────────────────────────────────────────────────────────
  if (variant === "lead") {
    return (
      <article
        data-topic={item.topic}
        className="group relative isolate overflow-hidden rounded-lg bg-pitch shadow-card transition-shadow duration-300 hover:shadow-lift"
      >
        <div className="absolute inset-0">
          <StoryImage
            src={item.imageUrl}
            alt={title}
            topic={item.topic}
            priority
            className="h-full w-full transition-transform duration-700 ease-out group-hover:scale-[1.04]"
            glyphClassName="text-8xl"
          />
        </div>
        <div className="photo-scrim absolute inset-0" />

        <div className="relative flex min-h-[26rem] flex-col justify-end gap-4 p-6 sm:min-h-[32rem] sm:p-9 lg:min-h-[34rem]">
          <div className="flex flex-wrap items-center gap-2">
            <TopicPill topic={item.topic} lang={language} tone="solid" />
            {item.coverageCount > 1 && (
              <span className="eyebrow inline-flex items-center gap-1.5 rounded-sm bg-black/55 px-2 py-1 text-white">
                <Newspaper className="h-3 w-3" aria-hidden="true" />
                {item.coverageCount} {t.outletsMany}
              </span>
            )}
          </div>

          <h2
            lang={langAttr}
            className={cn(
              "headline max-w-4xl text-[clamp(1.6rem,4.6vw,3.1rem)] font-bold tracking-[-0.025em] text-white",
              isNp ? "font-np leading-[1.3]" : "font-display-soft leading-[1.05]",
            )}
          >
            <button
              type="button"
              onClick={() => onOpen(item)}
              className="card-focus text-left after:absolute after:inset-0 after:content-['']"
            >
              {title}
            </button>
          </h2>

          {summary && (
            <p
              lang={langAttr}
              className={cn(
                "copy clamp-2 max-w-2xl text-[0.975rem] leading-relaxed text-white/85",
                isNp && "font-np",
              )}
            >
              {summary}
            </p>
          )}

          <div className="eyebrow flex flex-wrap items-center gap-x-3 gap-y-2 text-white/75">
            <SourceMark name={item.sourceName} />
            <span aria-hidden="true" className="h-3 w-px bg-white/40" />
            <span>{relative}</span>
          </div>
        </div>
      </article>
    );
  }

  // ── Side ─────────────────────────────────────────────────────────────────
  if (variant === "side") {
    return (
      <article
        data-topic={item.topic}
        className="group relative flex gap-4 border-b border-rule pb-4 last:border-b-0 last:pb-0"
      >
        <div className="min-w-0 flex-1 space-y-2">
          <TopicPill topic={item.topic} lang={language} />
          <h3
            lang={langAttr}
            className={cn(
              "headline clamp-3 text-[1.02rem] font-semibold tracking-tight text-ink transition-colors group-hover:text-[var(--topic)]",
              isNp ? "font-np leading-snug" : "font-display leading-[1.25]",
            )}
          >
            <button
              type="button"
              onClick={() => onOpen(item)}
              className="card-focus text-left after:absolute after:inset-0 after:content-['']"
            >
              {title}
            </button>
          </h3>
          <p className="eyebrow truncate text-ink-muted">
            {item.sourceName} · {relative}
          </p>
        </div>

        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md sm:h-24 sm:w-24">
          <StoryImage
            src={item.imageUrl}
            alt=""
            topic={item.topic}
            className="h-full w-full transition-transform duration-500 group-hover:scale-105"
            glyphClassName="text-2xl"
          />
        </div>
      </article>
    );
  }

  // ── Compact (trending rail) ──────────────────────────────────────────────
  if (variant === "compact") {
    return (
      <article
        data-topic={item.topic}
        className="group relative flex gap-3.5 border-b border-rule pb-4 last:border-b-0 last:pb-0"
      >
        <span
          aria-hidden="true"
          // Was text-rule-strong, which is 1.63:1 on the rail's surface — a rank
          // nobody can read is not a rank.
          className="font-display text-2xl leading-none font-black text-ink-muted transition-colors group-hover:text-[var(--topic)]"
        >
          {String(rank ?? 0).padStart(2, "0")}
        </span>

        <div className="min-w-0 flex-1 space-y-1.5">
          <h3
            lang={langAttr}
            className={cn(
              "clamp-3 text-sm leading-snug font-semibold text-ink transition-colors group-hover:text-[var(--topic)]",
              isNp && "font-np",
            )}
          >
            <button
              type="button"
              onClick={() => onOpen(item)}
              className="card-focus text-left after:absolute after:inset-0 after:content-['']"
            >
              {title}
            </button>
          </h3>
          <p className="eyebrow flex flex-wrap items-center gap-x-2 text-ink-muted">
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

  // ── Grid (default) ───────────────────────────────────────────────────────
  return (
    <article
      data-topic={item.topic}
      className="group relative flex flex-col overflow-hidden rounded-lg border border-rule bg-surface shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-[color-mix(in_oklab,var(--topic)_45%,transparent)] hover:shadow-lift"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden">
        <StoryImage
          src={item.imageUrl}
          alt=""
          topic={item.topic}
          className="h-full w-full transition-transform duration-700 ease-out group-hover:scale-[1.06]"
          glyphClassName="text-5xl"
        />
        <div className="absolute top-3 left-3">
          <TopicPill
            topic={item.topic}
            lang={language}
            tone="solid"
            className="shadow-sm"
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-4 sm:p-5">
        <h3
          lang={langAttr}
          className={cn(
            "headline clamp-3 text-[1.15rem] font-bold tracking-tight text-ink transition-colors group-hover:text-[var(--topic)]",
            isNp ? "font-np leading-snug" : "font-display leading-[1.2]",
          )}
        >
          <button
            type="button"
            onClick={() => onOpen(item)}
            className="card-focus text-left after:absolute after:inset-0 after:content-['']"
          >
            {title}
          </button>
        </h3>

        {summary && (
          <p
            lang={langAttr}
            className={cn(
              "copy clamp-3 text-sm leading-relaxed text-ink-soft",
              isNp && "font-np",
            )}
          >
            {summary}
          </p>
        )}

        <div className="eyebrow mt-auto flex items-center justify-between gap-2 border-t border-rule pt-3 text-ink-muted">
          <SourceMark name={item.sourceName} className="min-w-0" />
          <span className="shrink-0">{relative}</span>
        </div>
      </div>
    </article>
  );
}
