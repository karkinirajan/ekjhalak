"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  /** Stagger delay in ms — use the index within a grid for a cascade */
  delay?: number;
  as?: "div" | "section" | "article" | "li";
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
}: RevealProps) {
  // The union of tag names gives `ref` an unsatisfiable intersection type
  // (HTMLDivElement & HTMLLIElement & …). All we need from the node is
  // observe/disconnect, which every element supports, so narrow to one tag.
  const Tag = as as "div";
  const ref = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
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
  }, []);

  return (
    <Tag
      ref={ref}
      className={cn("reveal", className)}
      data-revealed={revealed}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
