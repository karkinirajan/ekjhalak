"use client";

import { ArrowUpRight, Clock, Newspaper } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { StoryImage } from "@/components/story-image";
import { SourceMark, TopicPill } from "@/components/topic-pill";
import { useFeedClock } from "@/components/feed-clock";
import { useTheme } from "@/components/theme-provider";
import {
  cn,
  formatRelativeTime,
  readingTime,
  sanitizeTextForDisplay,
  splitIntoParagraphs,
} from "@/lib/utils";
import type { NewsItem } from "@/lib/news-pipeline";

interface StoryReaderProps {
  item: NewsItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Full brief in a side panel.
 *
 * Deliberately a reading surface, not a preview: generous measure, large type,
 * and a single clear exit to the publisher. We only ever hold a summary, so the
 * panel is honest about that and puts "read at source" in the primary position.
 */
export function StoryReader({ item, open, onOpenChange }: StoryReaderProps) {
  const { t, language } = useTheme();
  const now = useFeedClock();

  if (!item) return null;

  const isNp = item.originalLang === "np";
  const langAttr = isNp ? "ne" : "en";
  const title = sanitizeTextForDisplay(item.title);
  const summary = sanitizeTextForDisplay(item.summary);
  const paragraphs = splitIntoParagraphs(summary, 5);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        data-topic={item.topic}
        // The width has to carry the same `data-[side=right]:sm:` prefix that
        // SheetContent's own default uses. A bare `sm:max-w-2xl` compiles to
        // specificity (0,1,0) and loses to the primitive's
        // `.data-[side=right]:sm:max-w-sm[data-side=right]` at (0,2,0), so the
        // panel silently rendered at 384px instead of 672px. Matching the prefix
        // also lets twMerge see the two as one utility and drop the default.
        className="w-full overflow-y-auto border-l-rule bg-canvas p-0 data-[side=right]:sm:max-w-[40rem]"
      >
        {/* Lead image doubles as the panel header */}
        <div className="relative h-52 w-full shrink-0 overflow-hidden sm:h-64">
          <StoryImage
            src={item.imageUrl}
            alt={title}
            topic={item.topic}
            priority
            className="h-full w-full"
            glyphClassName="text-6xl"
          />
          <div className="photo-scrim absolute inset-0" />
          <div className="absolute right-0 bottom-0 left-0 p-5 sm:p-7">
            <TopicPill topic={item.topic} lang={language} tone="solid" />
          </div>
        </div>

        <div className="space-y-6 p-5 pb-12 sm:p-7">
          <div className="space-y-4">
            <SheetTitle
              lang={langAttr}
              className={cn(
                "headline text-[1.7rem] leading-[1.16] font-semibold tracking-[-0.02em] text-ink sm:text-[2rem]",
                isNp ? "font-np leading-[1.35]" : "font-display",
              )}
            >
              {title}
            </SheetTitle>

            <div className="eyebrow flex flex-wrap items-center gap-x-3 gap-y-2 text-ink-muted">
              <SourceMark name={item.sourceName} />
              <span aria-hidden="true" className="h-3 w-px bg-rule" />
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3 w-3" aria-hidden="true" />
                {formatRelativeTime(item.publishedTimestamp, language, now)}
              </span>
              <span aria-hidden="true" className="h-3 w-px bg-rule" />
              <span>
                {readingTime(summary)} {t.minRead}
              </span>
              {item.coverageCount > 1 && (
                <>
                  <span aria-hidden="true" className="h-3 w-px bg-rule" />
                  <span className="inline-flex items-center gap-1.5 text-[var(--topic)]">
                    <Newspaper className="h-3 w-3" aria-hidden="true" />
                    {item.coverageCount} {t.outletsMany}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Drop-cap opener — a serif flourish that signals "this is an
              article", used only here where there is enough copy to carry it. */}
          <div className="space-y-4">
            {paragraphs.map((paragraph, index) => (
              <p
                key={index}
                lang={langAttr}
                className={cn(
                  "copy text-[1.0625rem] leading-[1.75] text-ink-soft",
                  isNp && "font-np text-[1.125rem] leading-[1.9]",
                  index === 0 &&
                    !isNp &&
                    "first-letter:float-left first-letter:mt-1 first-letter:mr-2.5 first-letter:font-display first-letter:text-[3.25rem] first-letter:leading-[0.82] first-letter:font-black first-letter:text-[var(--topic)]",
                )}
              >
                {paragraph}
              </p>
            ))}
          </div>

          <div className="flex flex-col gap-3 border-t border-rule pt-6 sm:flex-row sm:items-center">
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-full bg-red-solid px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90",
                language === "np" && "font-np",
              )}
            >
              {t.readFull}
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </a>
            <p className="eyebrow text-ink-muted">{item.publishedAt}</p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
