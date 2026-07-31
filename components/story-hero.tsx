"use client";

import { StoryCard } from "@/components/story-card";
import { Reveal } from "@/components/reveal";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import type { NewsItem } from "@/lib/news-pipeline";

interface StoryHeroProps {
  lead: NewsItem | null;
  side: NewsItem[];
  onOpen: (item: NewsItem) => void;
}

/**
 * The above-the-fold editorial block: one dominant story carrying the page,
 * with a stack of supporting headlines beside it.
 *
 * The asymmetry is the point — a grid of equal cards tells the reader nothing
 * about what matters, which was the core failure of the previous layout.
 */
export function StoryHero({ lead, side, onOpen }: StoryHeroProps) {
  const { t, language } = useTheme();
  const isNp = language === "np";

  if (!lead) return null;

  return (
    <section aria-label={t.leadStory} className="grid gap-6 lg:grid-cols-3">
      <Reveal className="lg:col-span-2">
        <StoryCard item={lead} variant="lead" onOpen={onOpen} />
      </Reveal>

      {side.length > 0 && (
        <Reveal delay={90} className="flex flex-col">
          <h2
            className={cn(
              "eyebrow mb-4 flex items-center gap-3 text-ink-muted",
              isNp && "font-np tracking-normal",
            )}
          >
            {t.moreHeadlines}
            <span className="h-px flex-1 bg-rule" />
          </h2>

          <div className="flex flex-col gap-4">
            {side.map((item) => (
              <StoryCard
                key={item.id}
                item={item}
                variant="side"
                onOpen={onOpen}
              />
            ))}
          </div>
        </Reveal>
      )}
    </section>
  );
}
