"use client";

import { TrendingUp } from "lucide-react";
import { StoryCard } from "@/components/story-card";
import { useSite } from "@/components/site-provider";
import { cn } from "@/lib/utils";
import type { NewsItem } from "@/lib/news-pipeline";

interface TrendingRailProps {
  items: NewsItem[];
  onOpen: (item: NewsItem) => void;
}

/**
 * Sticky sidebar of the most-covered stories.
 *
 * The ranking is how many independent newsrooms ran the same story, measured by
 * the deduplicator. That is a real editorial signal and it is stated plainly in
 * the subhead — this rail deliberately shows no view or share counts, because
 * this site does not measure either and inventing them would be a lie printed
 * next to real journalism.
 */
export function TrendingRail({ items, onOpen }: TrendingRailProps) {
  const { t, language } = useSite();
  const isNp = language === "np";

  if (items.length === 0) return null;

  return (
    <aside className="lg:sticky lg:top-32">
      <div className="rounded-sm border border-rule/20 bg-surface p-5">
        <div className="mb-5 border-b border-rule/20 pb-4">
          <h2
            className={cn(
              "flex items-center gap-2 text-lg font-bold tracking-tight text-ink",
              isNp ? "font-np" : "font-display",
            )}
          >
            <TrendingUp className="h-4 w-4 text-accent" aria-hidden="true" />
            {t.trendingSection}
          </h2>
          <p className={cn("mt-1.5 text-xs text-ink-muted", isNp && "font-np")}>
            {t.trendingHint}
          </p>
        </div>

        <ol className="flex flex-col gap-4">
          {items.map((item, index) => (
            <li key={item.id}>
              <StoryCard
                item={item}
                variant="compact"
                rank={index + 1}
                onOpen={onOpen}
              />
            </li>
          ))}
        </ol>
      </div>
    </aside>
  );
}
