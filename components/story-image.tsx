"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { TOPICS, type TopicId } from "@/lib/taxonomy";

interface StoryImageProps {
  src: string | null;
  alt: string;
  topic: TopicId;
  className?: string;
  /** Lead images above the fold should load eagerly */
  priority?: boolean;
  /** Scale of the fallback glyph */
  glyphClassName?: string;
}

/**
 * Lead image with generated fallback art.
 *
 * Uses a plain <img> rather than next/image on purpose: lead images come from
 * whatever CDN a publisher happens to use, and next/image rejects any host not
 * pre-listed in remotePatterns — a new source would render a broken card until
 * someone edited next.config.ts. A raw <img> degrades to the topic-coloured
 * cover art instead, which is also what runs when a feed ships no photo at all.
 */
export function StoryImage({
  src,
  alt,
  topic,
  className,
  priority = false,
  glyphClassName = "text-4xl",
}: StoryImageProps) {
  const [failed, setFailed] = useState(false);
  const showFallback = !src || failed;

  if (showFallback) {
    return (
      <div
        className={cn(
          "cover-art relative flex items-center justify-center overflow-hidden",
          className,
        )}
        role="img"
        aria-label={alt}
      >
        <span
          aria-hidden="true"
          className={cn("cover-glyph drop-shadow-sm", glyphClassName)}
        >
          {TOPICS[topic].glyph}
        </span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- arbitrary publisher CDNs; see note above
    <img
      src={src}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      // Some publishers block hotlinking by Referer; omitting it gets the image.
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={cn("h-full w-full object-cover", className)}
    />
  );
}
