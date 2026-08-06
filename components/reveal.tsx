"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  /** Stagger delay in ms — use the index within a grid for a cascade */
  delay?: number;
  as?: "div" | "section" | "article" | "li";
  /**
   * Render already revealed, with no observer and no transition.
   *
   * For content that is above the fold on arrival. There is nothing to reveal
   * on scroll for something the reader is already looking at, and the cost of
   * pretending otherwise is severe: `.reveal` sets `opacity: 0` in the
   * server-rendered HTML, so an above-the-fold card stays invisible until the
   * bundle has downloaded, hydrated, run the observer and finished a 600ms
   * transition. Measured on production: the lead card's image finished
   * downloading at 1.4s and Largest Contentful Paint was recorded at 6.0s.
   */
  immediate?: boolean;
}

/**
 * Fades content up as it scrolls into view.
 *
 * Reveals once and then stops observing — re-animating on every scroll past is
 * distracting on a page people scan. Content above the fold is revealed on the
 * observer's first synchronous callback, so nothing waits on a scroll event.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  as = "div",
  immediate = false,
}: RevealProps) {
  // The union of tag names gives `ref` an unsatisfiable intersection type
  // (HTMLDivElement & HTMLLIElement & …). All we need from the node is
  // observe/disconnect, which every element supports, so narrow to one tag.
  const Tag = as as "div";
  const ref = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(immediate);

  useEffect(() => {
    if (immediate) return;
    const node = ref.current;
    if (!node) return;

    // No IntersectionObserver (old browsers, some test environments): show it.
    if (typeof IntersectionObserver === "undefined") {
      startTransition(() => setRevealed(true));
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [immediate]);

  return (
    <Tag
      ref={ref}
      className={cn("reveal", className)}
      data-revealed={revealed}
      // No stagger on immediate content either. The delay only exists to make a
      // scroll-in cascade read as one motion, and there is no cascade here.
      style={delay && !immediate ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
