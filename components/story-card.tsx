"use client";

import { Newspaper } from "lucide-react";
import { StoryImage } from "@/components/story-image";
import { SourceMark, TopicPill } from "@/components/topic-pill";
import { useFeedClock } from "@/components/feed-clock";
import { useTheme } from "@/components/theme-provider";
import { langAttr, storyText } from "@/lib/story-text";
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

const GRID_SUMMARY_CHARS = 190;

/**
 * The picture frame.
 *
 * No border of its own. The topic colour used to be a hairline around the
 * photograph, which meant every card carried two competing rectangles — the
 * card's edge and the picture's — and the coloured one belonged to the smaller,
 * less important of the two. The colour now runs around the whole card, so a
 * card is one categorised object and the photograph is simply part of it.
 *
 * The radius is written as a literal rather than as `rounded-sm` because the
 * derived Tailwind scale is driven by `--radius`, and pinning it here keeps the
 * frame square-cornered no matter what that token is set to.
 */
const IMAGE_FRAME =
  "overflow-hidden rounded-[3px] bg-raised/60 border border-rule/70";

/**
 * One story, in two editorial weights.
 *
 *   grid    — the feed card: text column on the left, photograph on the right
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

  const text = storyText(item, language);
  const isNp = text.lang === "np";
  const title = sanitizeTextForDisplay(text.title);
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
            lang={langAttr(text.lang)}
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
    sanitizeTextForDisplay(text.summary),
    GRID_SUMMARY_CHARS,
  );

  // Text left, picture right.
  //
  // `h-full` plus `mt-auto` on the footer: grid items stretch to the tallest
  // card in their row, so without this the source line floats wherever the
  // headline happens to end and the row reads as ragged.
  //
  // The topic colour lives on this element's border, which is what makes the
  // whole card the categorised object. It sits at 45% against the card surface
  // at rest so a grid of eleven topics reads as a page rather than a paint
  // chart, and resolves to the full colour on hover.
  return (
    <article
      data-topic={item.topic}
      className="group relative flex h-full flex-col overflow-hidden rounded-[3px] border border-[color-mix(in_oklab,var(--topic)_45%,var(--rule))] bg-surface transition-colors duration-200 hover:border-(--topic) hover:bg-raised/40"
    >
      <div className="flex flex-1 items-start gap-4 p-4">
        <div className="flex min-w-0 flex-1 flex-col self-stretch">
          <div className="flex flex-wrap items-center gap-2">
            <TopicPill topic={item.topic} lang={language} tone="quiet" />
            <span className="eyebrow text-ink-muted">{relative}</span>
          </div>

          <h3
            lang={langAttr(text.lang)}
            className={cn(
              "mt-2.5 text-[1.06rem] leading-[1.3] font-semibold tracking-[-0.015em] text-ink transition-colors group-hover:text-(--topic)",
              isNp ? "font-np leading-[1.45]" : "font-display",
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
              lang={langAttr(text.lang)}
              className={cn(
                "clamp-3 mt-2 text-[0.9rem] leading-[1.65] text-ink-soft",
                isNp && "font-np leading-[1.75]",
              )}
            >
              {summary}
            </p>
          )}

          <div className="eyebrow mt-auto flex flex-wrap items-center gap-x-2.5 gap-y-1.5 pt-3 text-ink-muted">
            <SourceMark name={item.sourceName} className="min-w-0" />
            <span aria-hidden="true" className="h-3 w-px shrink-0 bg-rule" />
            <time
              dateTime={new Date(item.publishedTimestamp).toISOString()}
              className="tabular-nums"
            >
              {item.publishedAt}
            </time>
            {item.coverageCount > 1 && (
              <>
                <span aria-hidden="true" className="h-3 w-px shrink-0 bg-rule" />
                <span className="inline-flex items-center gap-1.5 text-(--topic)">
                  <Newspaper className="h-3 w-3" aria-hidden="true" />
                  {item.coverageCount} {t.outletsMany}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Fixed width, fixed ratio, `self-start`: the picture column is the same
            size on every card in the grid regardless of how long the headline
            beside it runs. Without `self-start` the row's `items-start` would
            still leave the frame free to grow on a tall card.
            It steps up between the one-column and two-column layouts so the
            picture stays in proportion to a card that roughly doubles in width. */}
        <div
          className={cn(
            "aspect-4/3 w-24 shrink-0 self-start sm:w-36 xl:w-32",
            IMAGE_FRAME,
          )}
        >
          <StoryImage
            src={item.imageUrl}
            alt={title}
            topic={item.topic}
            priority={priority}
            className="h-full w-full"
          />
        </div>
      </div>
    </article>
  );
}
