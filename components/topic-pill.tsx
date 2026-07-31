"use client";

import { cn, sourceMonogram } from "@/lib/utils";
import { topicLabel, type TopicId } from "@/lib/taxonomy";
import type { Lang } from "@/lib/i18n";

interface TopicPillProps {
  topic: TopicId;
  lang: Lang;
  /** `solid` for use over photography, `quiet` for use on paper */
  tone?: "solid" | "quiet";
  className?: string;
}

/**
 * Category label. Colour comes from `--topic`, which the nearest ancestor
 * carrying `data-topic` supplies — so the pill matches whatever story it sits on
 * without any per-topic class list here.
 */
export function TopicPill({
  topic,
  lang,
  tone = "quiet",
  className,
}: TopicPillProps) {
  return (
    <span
      data-topic={topic}
      className={cn(
        "eyebrow inline-flex shrink-0 items-center gap-1.5 rounded-sm px-2 py-1 leading-none",
        tone === "solid"
          ? "bg-[var(--topic)] text-white"
          : "bg-[color-mix(in_oklab,var(--topic)_13%,transparent)] text-[var(--topic)]",
        className,
      )}
    >
      {topic === "breaking" && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="pulse-dot absolute inline-flex h-full w-full" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      )}
      {topicLabel(topic, lang)}
    </span>
  );
}

interface SourceMarkProps {
  name: string;
  className?: string;
  showName?: boolean;
}

/**
 * Publication attribution: an initials monogram plus the outlet's name.
 *
 * This is where a consumer news site would put an author avatar — RSS feeds
 * rarely carry a byline and never carry a photo, so we credit the newsroom,
 * which is the attribution we can actually stand behind.
 */
export function SourceMark({
  name,
  className,
  showName = true,
}: SourceMarkProps) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <span
        aria-hidden="true"
        className="eyebrow flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--topic,var(--coral))] text-[9px] tracking-normal text-white"
      >
        {sourceMonogram(name)}
      </span>
      {showName && <span className="truncate">{name}</span>}
    </span>
  );
}
