import { cn } from "@/lib/utils";

/**
 * The masthead mark — the Himalaya and the world standing on the same horizon
 * with the day's dispatches stacked between them, which is the masthead promise
 * drawn rather than written.
 *
 * It used to carry the brand lockup underneath, set on a bordered plate. That
 * printed "EkJhalak / एक झलक" a second time, roughly 400px to the left of the
 * <h1> saying exactly the same two words at five times the size — a nameplate
 * with the paper's name on it twice reads as a mistake, not as a device. The
 * type came out; the drawing stayed, because the drawing is the part that says
 * something the wordmark cannot.
 *
 * Losing the plate also lost the border, which was the other problem: a filled,
 * stroked rectangle in the middle of a broadsheet masthead reads as a UI card
 * sitting on the page rather than as ink printed into it.
 *
 * Inline SVG rather than a file in /public so it draws from the design tokens:
 * the flag and the lit summit are `--red`, the globe is `--green`. If the
 * palette moves, the mark moves with it.
 *
 * Hidden from assistive tech: it is a drawing of what the <h1> beside it
 * already says.
 */
export function BrandBanner({ className }: { className?: string }) {
  return (
    <svg
      viewBox="24 24 432 90"
      aria-hidden="true"
      focusable="false"
      className={cn("h-16 w-auto xl:h-[4.5rem]", className)}
    >
      {/* ── Mark ─────────────────────────────────────────────────────────── */}

      {/* Masthead flag — the coloured bar a paper puts beside its nameplate. */}
      <rect x="34" y="36" width="5" height="68" rx="2.5" fill="var(--accent)" />

      {/* The shared horizon. Doubles as the rule between mark and lockup. */}
      <line
        x1="34"
        y1="104"
        x2="446"
        y2="104"
        stroke="var(--rule-strong)"
        strokeWidth="2"
      />

      {/* The range. */}
      <path
        d="M54 104 L78 74 L90 84 L112 50 L124 64 L146 34 L166 68 L180 56 L198 104 Z"
        fill="var(--rule-strong)"
      />
      {/* Summit, lit — the lead story of the day. */}
      <path d="M146 34 L160 52 L132 52 Z" fill="var(--accent)" />

      {/* Dispatches, stacked newest-first. */}
      <rect x="216" y="56" width="64" height="4" rx="2" fill="var(--accent)" />
      <rect
        x="216"
        y="72"
        width="46"
        height="4"
        rx="2"
        fill="var(--ink-muted)"
      />
      <rect
        x="216"
        y="88"
        width="57"
        height="4"
        rx="2"
        fill="var(--ink-muted)"
        opacity="0.6"
      />

      {/* The world, rising on the same line as the mountains. */}
      <g fill="none" stroke="var(--support)" strokeLinecap="round">
        <path d="M332 104 A44 44 0 0 1 420 104" strokeWidth="2.5" />
        <path
          d="M347 104 A29 44 0 0 1 405 104"
          strokeWidth="1.5"
          opacity="0.65"
        />
        <path
          d="M361 104 A15 44 0 0 1 391 104"
          strokeWidth="1.5"
          opacity="0.65"
        />
        <line
          x1="338"
          y1="82"
          x2="414"
          y2="82"
          strokeWidth="1.5"
          opacity="0.65"
        />
        <line
          x1="356"
          y1="65"
          x2="396"
          y2="65"
          strokeWidth="1.5"
          opacity="0.65"
        />
      </g>
    </svg>
  );
}
