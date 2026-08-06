"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { resolveStoryImageSource } from "@/lib/default-images";
import { isOptimizableImage } from "@/lib/image-hosts";
import { cn } from "@/lib/utils";
import { type TopicId } from "@/lib/taxonomy";

interface StoryImageProps {
  src: string | null;
  alt: string;
  topic: TopicId;
  className?: string;
  /** Lead images above the fold should load eagerly */
  priority?: boolean;
  /**
   * How wide this image actually paints, as a `sizes` attribute.
   *
   * Not optional in practice even though the type allows it: without it the
   * browser assumes 100vw and downloads a variant sized for the viewport, which
   * for an 80px rail thumbnail is the entire point of this component undone.
   */
  sizes?: string;
}

/** 16:10, the ratio every frame in the UI crops to. Sets the srcset ladder. */
const INTRINSIC_WIDTH = 1280;
const INTRINSIC_HEIGHT = 800;

/**
 * Lead image with generated fallback art.
 *
 * Publisher images go through `next/image` when their host is on the allowlist
 * in lib/image-hosts.ts, and through a plain `<img>` when it is not.
 *
 * The fallback is not a hedge, it is the reason this component exists. Lead
 * images come from whatever CDN a publisher happens to use, and `next/image`
 * throws on any host missing from `remotePatterns` rather than degrading — so
 * using it unconditionally would mean a new source rendering broken cards until
 * someone edited a config file. Asking the allowlist first keeps that from being
 * possible: an unlisted host loses optimization and nothing else.
 *
 * It matters because publishers ship their originals. The homepage's LCP element
 * was a 2.4 MB JPEG from a WordPress install, painted into a 378x236 slot — one
 * file accounting for 2,354 KB of the page's 2,382 KB of image waste.
 */
export function StoryImage({
  src,
  alt,
  topic,
  className,
  priority = false,
  sizes = "100vw",
}: StoryImageProps) {
  const [failed, setFailed] = useState(false);
  const resolvedSrc = useMemo(() => {
    if (failed) return resolveStoryImageSource(null, topic);
    return resolveStoryImageSource(src, topic);
  }, [failed, src, topic]);

  // `alt` is passed explicitly at both call sites rather than spread in. The
  // jsx-a11y rule cannot see through a spread, and neither can a reader.
  const shared = {
    onError: () => setFailed(true),
    className: cn("h-full w-full object-cover", className),
  };

  if (isOptimizableImage(resolvedSrc)) {
    return (
      <Image
        {...shared}
        alt={alt}
        src={resolvedSrc}
        width={INTRINSIC_WIDTH}
        height={INTRINSIC_HEIGHT}
        sizes={sizes}
        priority={priority}
        // Publishers crop for their own layouts, so a resize that preserved the
        // original ratio would letterbox inside a 16:10 frame. The frame already
        // enforces the ratio in CSS; these are the intrinsic dimensions the
        // optimizer builds its srcset from, not a promise about the source.
        quality={70}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- unlisted publisher CDNs and local fallback art both need direct rendering; see the doc comment
    <img
      {...shared}
      alt={alt}
      src={resolvedSrc}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      sizes={sizes}
      // Some publishers block hotlinking by Referer; omitting it gets the image.
      referrerPolicy="no-referrer"
    />
  );
}
