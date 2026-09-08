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
 * The category kicker.
 *
 * Two tones, and they are now genuinely different things rather than two
 * treatments of a chip:
 *
 *   quiet  — on paper, this is a kicker: uppercase, tracked, in the category's
 *            reading colour, with no fill, no border and no chip around it.
 *            That is how the Kathmandu Post sets OPINION, how the Guardian sets
 *            its section labels and how the NYT sets its own. The filled,
 *            bordered, tinted pill this replaced was the single most
 *            product-looking element on the feed, repeated once per story.
 *
 *   solid  — over photography, where a kicker in any colour is illegible
 *            against whatever the publisher shipped. Here it stays a small
 *            solid chip printing `--topic-ink` on `--topic`, which is exactly
 *            what Setopati does with its red kicker chip.
 *
 * Colour comes from the three-token topic contract that the nearest ancestor
 * carrying `data-topic` supplies, so the kicker matches whatever story it sits
 * on without any per-topic class list here.
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
        "eyebrow inline-flex shrink-0 items-center gap-1.5 leading-none",
        tone === "solid"
          ? // `text-topic-ink` is declared per category, so this one class
            // prints white on the seven deep fills and near-navy on the two
            // light ones. At 11px the 4.5:1 floor is not negotiable, and no
            // single literal meets it for both.
            "rounded-sm bg-[var(--topic)] px-1.5 py-1 text-topic-ink"
          : "text-[var(--topic-text)]",
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
        className="eyebrow flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-[var(--topic)] text-[9px] tracking-normal text-topic-ink"
      >
        {sourceMonogram(name)}
      </span>
      {showName && <span className="truncate">{name}</span>}
    </span>
  );
}
