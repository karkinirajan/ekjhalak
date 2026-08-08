"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import { TOPIC_ORDER, topicLabel, type TopicId } from "@/lib/taxonomy";
import type { RangeKey } from "@/lib/news-pipeline";

export type BucketFilter = "all" | "national" | "international";
export type TopicFilter = TopicId | "all";

interface CategoryNavProps {
  topic: TopicFilter;
  setTopic: (value: TopicFilter) => void;
  bucket: BucketFilter;
  setBucket: (value: BucketFilter) => void;
  range: RangeKey;
  setRange: (value: RangeKey) => void;
  /** Story counts per topic in the current result set — topics with none are hidden */
  topicCounts: Record<string, number>;
  resultCount: number;
}

/**
 * Sticky section navigation.
 *
 * Two rows on desktop, one scrollable row on mobile. Topics with no stories in
 * the current window are omitted rather than rendered dead — an empty category
 * tab that yields nothing is worse than no tab.
 */
export function CategoryNav({
  topic,
  setTopic,
  bucket,
  setBucket,
  range,
  setRange,
  topicCounts,
  resultCount,
}: CategoryNavProps) {
  const { t, language } = useTheme();
  const activeRef = useRef<HTMLButtonElement>(null);
  const isNp = language === "np";

  // Keep the selected topic visible when the rail overflows on narrow screens.
  useEffect(() => {
    activeRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [topic]);

  const availableTopics = TOPIC_ORDER.filter(
    (id) => (topicCounts[id] ?? 0) > 0,
  );

  const buckets: { key: BucketFilter; label: string }[] = [
    { key: "all", label: t.feedAll },
    { key: "national", label: t.feedNational },
    { key: "international", label: t.feedInternational },
  ];

  const ranges: { key: RangeKey; label: string }[] = [
    { key: "day", label: t.rangeDay },
    { key: "week", label: t.rangeWeek },
    { key: "month", label: t.rangeMonth },
  ];

  return (
    <nav
      // Its own label, not the footer's. Both landmarks were announced as
      // "Sections", which is the moderate axe `landmark-unique` violation from
      // the Phase 1 baseline: a screen-reader user listing landmarks got two
      // identical entries and no way to tell the sticky topic bar from the
      // footer's link list.
      aria-label={t.topicNav}
      className="sticky top-0 z-30 border-b border-rule glass"
    > 
      <div className="mx-auto w-full max-w-350 px-4 sm:px-6 lg:px-8">
        {/* ── Topic rail ─────────────────────────────────────────────────── */}
        <div className="-mx-4 flex items-center gap-1 overflow-x-auto px-4 py-2 scrollbar-none sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <button
            type="button"
            ref={topic === "all" ? activeRef : undefined}
            onClick={() => setTopic("all")}
            aria-current={topic === "all" ? "true" : undefined}
            className={cn(
              "eyebrow shrink-0 rounded-full px-4 py-1.5 transition-all duration-300 sm:px-4",
              topic === "all"
                ? "bg-ink text-canvas shadow-md"
                : "text-ink-muted hover:bg-raised hover:text-ink",
              isNp && "font-np tracking-normal",
            )}
          >
            {t.allTopics}
          </button>

          <span aria-hidden="true" className="mx-1 h-4 w-px shrink-0 bg-rule" />

          {availableTopics.map((id) => {
            const isActive = topic === id;
            return (
              <button
                key={id}
                type="button"
                ref={isActive ? activeRef : undefined}
                data-topic={id}
                onClick={() => setTopic(id)}
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "eyebrow shrink-0 rounded-full px-4 py-1.5 transition-all duration-300",
                  isActive
                    ? "bg-[var(--topic)] text-topic-ink shadow-[0_0_12px_color-mix(in_srgb,var(--topic)_50%,transparent)]"
                    : "text-ink-muted hover:bg-[color-mix(in_srgb,var(--topic)_15%,transparent)] hover:text-[var(--topic)]",
                  isNp && "font-np tracking-normal",
                )}
              >
                {topicLabel(id, language)}
                {/* The count is rendered slightly muted when inactive, but must match the active ink color (with slight opacity) when the pill is solid to maintain WCAG contrast against the vibrant background. */}
                <span 
                  className={cn(
                    "ml-1.5 tabular-nums",
                    isActive ? "text-topic-ink opacity-90" : "text-ink-muted"
                  )}
                >
                  {topicCounts[id]}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Region + range rail ────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-rule/60 py-2">
          <div className="flex items-center gap-1">
            {buckets.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setBucket(option.key)}
                aria-pressed={bucket === option.key}
                className={cn(
                  "rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-300",
                  bucket === option.key
                    ? "bg-red text-white shadow-[0_0_12px_color-mix(in_srgb,var(--red)_50%,transparent)]"
                    : "text-ink-muted hover:bg-raised/50 hover:text-ink",
                  isNp && "font-np",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-0.5">
              {ranges.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setRange(option.key)}
                  aria-pressed={range === option.key}
                  className={cn(
                    "eyebrow rounded-md px-2.5 py-1 transition-colors",
                    range === option.key
                      ? "text-ink underline decoration-red decoration-2 underline-offset-4"
                      : "text-ink-muted hover:text-ink",
                    isNp && "font-np tracking-normal",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <span
              aria-hidden="true"
              className="hidden h-4 w-px bg-rule sm:block"
            />

            <span
              className={cn(
                "eyebrow hidden tabular-nums text-ink-muted sm:inline",
                isNp && "font-np tracking-normal",
              )}
              aria-live="polite"
            >
              {resultCount} {t.filtered}
            </span>
          </div>
        </div>
      </div>
    </nav>
  );
}
