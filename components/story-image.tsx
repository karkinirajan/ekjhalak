"use client";

import { useMemo, useState } from "react";
import { resolveStoryImageSource } from "@/lib/default-images";
import { cn } from "@/lib/utils";
import { type TopicId } from "@/lib/taxonomy";

interface StoryImageProps {
  src: string | null;
  alt: string;
  topic: TopicId;
  className?: string;
  /** Lead images above the fold should load eagerly */
  priority?: boolean;
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
}: StoryImageProps) {
  const [failed, setFailed] = useState(false);
  const resolvedSrc = useMemo(() => {
    if (failed) return resolveStoryImageSource(null, topic);
    return resolveStoryImageSource(src, topic);
  }, [failed, src, topic]);

  return (
    // eslint-disable-next-line @next/next/no-img-element -- arbitrary publisher CDNs and local fallback art both need direct image rendering
    <img
      src={resolvedSrc}
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
