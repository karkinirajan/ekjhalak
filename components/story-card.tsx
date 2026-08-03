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
 * The rail thumbnail's frame.
 *
 * No topic colour on it. That hairline used to sit around the photograph, which
 * meant every card carried two competing rectangles — the card's edge and the
 * picture's — and the coloured one belonged to the smaller, less important of
 * the two. The colour now runs around the whole card, so a card is one
 * categorised object and the photograph is simply part of it.
 */
const THUMB_FRAME = "overflow-hidden rounded-sm bg-raised/60 border border-rule/60";

/**
 * The card's border, at rest and on hover.
 *
 * Mixed into `--rule` rather than used neat. A full-strength topic hairline
 * around every card turned a page of eleven categories into a colour chart and
 * shouted louder than the headlines it framed. At 22% the colour is a tint on
 * the ordinary rule — present enough to categorise a card once you look for it,
 * quiet enough to disappear while you read. Hover resolves it most of the way
 * toward the real colour, which is where a category badge belongs: on the card
 * you are actually pointing at.
 */
const CARD_BORDER =
  "border border-[color-mix(in_oklab,var(--topic)_22%,var(--rule))] hover:border-[color-mix(in_oklab,var(--topic)_70%,var(--rule))]";

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
        <div className={cn("aspect-16/10 w-20 shrink-0 self-start", THUMB_FRAME)}>
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

  // Text left, picture right, and the picture is a full-height column rather
  // than a thumbnail floating in the padding.
  //
  // The <article> is itself the row — there is no inner wrapper — so the picture
  // is a flex child of the card and `self-stretch` gives it the card's whole
  // height. It runs flush to the top, right and bottom edges; `overflow-hidden`
  // on the card is what rounds its two outer corners, so the frame needs no
  // radius of its own and nothing has to know which corners to round.
  //
  // `h-full` plus `mt-auto` on the footer: grid items stretch to the tallest
  // card in their row, so without this the source line floats wherever the
  // headline happens to end and the row reads as ragged. It is also what makes
  // every picture in a row the same height.
  return (
    <article
      data-topic={item.topic}
      className={cn(
        "group relative flex h-full overflow-hidden rounded-md bg-surface transition-colors duration-200 hover:bg-raised/40",
        CARD_BORDER,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col p-4">
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

      {/* Fixed width, full height. The width steps up between the one-column and
          two-column layouts so the picture keeps its proportion on a card that
          roughly doubles in width; the height is whatever the card is, which the
          grid has already equalised across the row. `object-cover` on the image
          means a tall card crops the photograph rather than distorting it. */}
      <div className="w-28 shrink-0 self-stretch overflow-hidden bg-raised/60 sm:w-36 xl:w-40">
        <StoryImage
          src={item.imageUrl}
          alt={title}
          topic={item.topic}
          priority={priority}
          className="h-full w-full"
        />
      </div>
    </article>
  );
}
