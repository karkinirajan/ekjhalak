"use client";

import Link from "next/link";
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

/**
 * A headline that is a real link and also opens the reading panel.
 *
 * These used to be `<button onClick>`, which meant the fastest path into a
 * story existed only for someone holding a mouse and running JavaScript: no
 * href to crawl, nothing to copy as a share link, no open-in-new-tab, and a
 * control announced as a button when it navigates.
 *
 * So it is an anchor to the story's permalink, and a plain left-click is
 * intercepted to open the panel instead — the in-page reading experience is the
 * better one and it stays the default. Anything the browser treats as "open this
 * somewhere else" (⌘/Ctrl/Shift/Alt, middle-click) is left alone, because a
 * reader who asked for a new tab is asking for the page, not the panel.
 */
function isPlainLeftClick(event: React.MouseEvent): boolean {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

interface StoryCardProps {
  item: NewsItem;
  variant?: StoryVariant;
  onOpen: (item: NewsItem) => void;
  /** Rank number, shown by the compact variant in the trending rail */
  rank?: number;
  /** Cards in the first row load their photograph eagerly */
  priority?: boolean;
}

/** Sized to a three-line clamp at the card's ~312px measure. */
const GRID_SUMMARY_CHARS = 155;

/**
 * The rail thumbnail's frame.
 *
 * No topic colour on it. That hairline used to sit around the photograph, which
 * meant every card carried two competing rectangles — the card's edge and the
 * picture's — and the coloured one belonged to the smaller, less important of
 * the two. The colour now runs around the whole card, so a card is one
 * categorised object and the photograph is simply part of it.
 */
const THUMB_FRAME =
  "overflow-hidden rounded-md bg-raised/60 border border-rule/50";

/**
 * The card's border, at rest and on hover.
 *
 * Mixed into `--rule` rather than used neat. A full-strength topic hairline
 * around every card turned a page of eleven categories into a colour chart and
 * shouted louder than the headlines it framed. At 15% the colour is barely a
 * tint on the ordinary rule — enough to categorise a card once you look for it,
 * gone while you read. Hover resolves it most of the way toward the real
 * colour, which is where a category cue belongs: on the card you are pointing
 * at, not on all twelve at once.
 */
const CARD_BORDER =
  "border border-[color-mix(in_oklab,var(--topic)_15%,var(--rule))] hover:border-[color-mix(in_oklab,var(--topic)_65%,var(--rule))]";

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
            // Fixed 80px frame at every breakpoint — see the note above.
            sizes="80px"
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
            <Link
              href={`/story/${item.id}`}
              onClick={(event) => {
                if (!isPlainLeftClick(event)) return;
                event.preventDefault();
                onOpen(item);
              }}
              className="card-focus cursor-pointer text-left"
            >
              {title}
            </Link>
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

  // Picture across the top, text beneath it.
  //
  // `h-full` plus `mt-auto` on the meta block: grid items stretch to the tallest
  // card in their row, so without this the source line floats wherever the
  // headline happens to end and the row reads as ragged.
  //
  // The picture is full-bleed — no padding around it, no frame of its own. The
  // card's `overflow-hidden` is what rounds its top two corners, so nothing has
  // to know which corners to round, and `aspect-16/10` is what makes every
  // picture in the grid exactly the same size whatever the publisher shipped.
  return (
    <article
      data-topic={item.topic}
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-md bg-surface transition-colors duration-200 hover:bg-raised/40",
        CARD_BORDER,
      )}
    >
      <div className="aspect-16/10 w-full shrink-0 overflow-hidden bg-raised/60">
        <StoryImage
          src={item.imageUrl}
          alt={title}
          topic={item.topic}
          priority={priority}
          // The grid is 1 column, then 2 at sm, then 2 within a main column that
          // gives up 20rem to the sidebar at lg, then 3 at xl. At a 1440px
          // viewport the xl card paints about 350px, so 400px is the ceiling
          // rather than a guess.
          sizes="(min-width: 1280px) 400px, (min-width: 1024px) 45vw, (min-width: 640px) 50vw, 100vw"
          className="h-full w-full"
        />
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <TopicPill topic={item.topic} lang={language} tone="quiet" />
          <span className="eyebrow text-ink-muted">{relative}</span>
        </div>

        <h3
          lang={langAttr(text.lang)}
          className={cn(
            "mt-3 text-[1.08rem] leading-[1.32] font-semibold tracking-[-0.015em] text-ink transition-colors group-hover:text-(--topic)",
            isNp ? "font-np leading-[1.5]" : "font-display",
          )}
        >
          <Link
            href={`/story/${item.id}`}
            onClick={(event) => {
              if (!isPlainLeftClick(event)) return;
              event.preventDefault();
              onOpen(item);
            }}
            className="card-focus cursor-pointer text-left"
          >
            {title}
          </Link>
        </h3>

        {summary && (
          <p
            lang={langAttr(text.lang)}
            className={cn(
              "clamp-3 mt-2.5 text-[0.9rem] leading-[1.7] text-ink-soft",
              isNp && "font-np leading-[1.8]",
            )}
          >
            {summary}
          </p>
        )}

        {/* The wrapper carries `mt-auto` rather than the meta row itself.
            `mt-auto` resolves to zero once the copy above fills the card, which
            would leave the hairline sitting directly against the last line of
            the summary on exactly the tallest card in each row — the one most
            in need of the breathing room. Padding on a wrapper is a floor the
            auto margin cannot eat. */}
        <div className="mt-auto pt-5">
          <div className="eyebrow flex flex-wrap items-center gap-x-2.5 gap-y-1.5 border-t border-rule/60 pt-3.5 text-ink-muted">
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
      </div>
    </article>
  );
}
