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

export type StoryVariant = "grid" | "compact";

interface StoryCardProps {
  item: NewsItem;
  variant?: StoryVariant;
  onOpen: (item: NewsItem) => void;
  /** Rank number, shown by the compact variant in the trending rail */
  rank?: number;
  /** Cards in the first row load their photograph eagerly */
  priority?: boolean;
}

const GRID_SUMMARY_CHARS = 150;

/**
 * Every story picture is framed identically: a 16:10 rectangle, a small corner,
 * and a hairline in the story's own category colour. `--topic` is supplied by
 * the `data-topic` attribute on the surrounding <article>, so each frame is
 * categorised without a per-topic class list here.
 *
 * The radius is written as a literal rather than as `rounded-sm` because this
 * theme sets `--radius: 9999px` to make the shadcn buttons pills, and the whole
 * derived scale — `rounded-sm` through `rounded-2xl` — inherits from it. A
 * `rounded-sm` frame would render as a stadium. `0.25rem` is the value stock
 * Tailwind gives `rounded-sm`, and it is what keeps these frames rectangular.
 */
const IMAGE_FRAME =
  "overflow-hidden rounded-[0.25rem] border border-(--topic) bg-raised/50";

/**
 * One story, in two editorial weights.
 *
 *   grid    — the feed card: photo above, headline and standfirst below
 *   compact — ranked text row for the trending rail
 *
 * There is no dominant lead variant. Every story in the feed is rendered at the
 * same weight in a single grid, and importance is carried by position alone —
 * the highest-scoring story is simply the first card.
 *
 * Both variants share one interaction model: the whole card opens the reader
 * panel, and the headline is the accessible name of that control.
 */
export function StoryCard({
  item,
  variant = "grid",
  onOpen,
  rank,
  priority = false,
}: StoryCardProps) {
  const { t, language } = useTheme();
  const now = useFeedClock();

  const isNp = item.originalLang === "np";
  const langAttr = isNp ? "ne" : "en";
  const title = sanitizeTextForDisplay(item.title);
  const relative = formatRelativeTime(item.publishedTimestamp, language, now);

  if (variant === "compact") {
    return (
      <article
        data-topic={item.topic}
        className="group relative flex gap-3.5 py-1"
      >
        {/* `self-start` is load-bearing, not alignment taste. This <article> is
            a row flex container, so the default `align-items: stretch` gives the
            frame its cross size from the flex line — which is the height of the
            headline column — and `aspect-16/10` never gets applied. Rail rows
            then render thumbnails between 50px and 122px tall depending on how
            many lines their headline wraps to. `self-start` restores auto
            sizing so the ratio wins and every thumbnail is 80×50. */}
        <div className={cn("aspect-16/10 w-20 shrink-0 self-start", IMAGE_FRAME)}>
          <StoryImage
            src={item.imageUrl}
            alt={title}
            topic={item.topic}
            className="h-full w-full"
          />
        </div>

        <span
          aria-hidden="true"
          className="font-display text-2xl leading-none font-semibold text-ink-muted transition-colors group-hover:text-(--topic)"
        >
          {String(rank ?? 0).padStart(2, "0")}
        </span>

        <div className="min-w-0 flex-1">
          <h3
            lang={langAttr}
            className={cn(
              "text-sm font-semibold leading-snug text-ink transition-colors group-hover:text-(--topic)",
              isNp && "font-np",
            )}
          >
            <button
              type="button"
              onClick={() => onOpen(item)}
              className="card-focus cursor-pointer text-left"
            >
              {title}
            </button>
          </h3>
          <p className="mt-1.5 eyebrow flex flex-wrap items-center gap-x-2 text-ink-muted">
            <span className="truncate">{item.sourceName}</span>
            {item.coverageCount > 1 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-(--topic)">
                  {item.coverageCount} {t.outletsMany}
                </span>
              </>
            )}
          </p>
        </div>
      </article>
    );
  }

  const summary = truncate(
    sanitizeTextForDisplay(item.summary),
    GRID_SUMMARY_CHARS,
  );

  // `h-full` plus `mt-auto` on the footer: grid items stretch to the tallest
  // card in their row, so without this the source line floats wherever the
  // headline happens to end and the row reads as ragged.
  return (
    <article
      data-topic={item.topic}
      className="group relative flex h-full flex-col border-l border-transparent py-3 pl-4 transition-all duration-200 hover:border-(--topic) hover:bg-raised/40"
    >
      <div className={cn("mb-3 aspect-16/10 w-full", IMAGE_FRAME)}>
        <StoryImage
          src={item.imageUrl}
          alt={title}
          topic={item.topic}
          priority={priority}
          className="h-full w-full"
        />
      </div>

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
          className="card-focus cursor-pointer text-left"
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

      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 pt-3 text-[0.8rem] uppercase tracking-[0.16em] text-ink-muted">
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
