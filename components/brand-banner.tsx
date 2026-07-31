import { cn } from "@/lib/utils";

/**
 * The nameplate banner — a 1:3 plate that sits beside the wordmark.
 *
 * One idea, drawn rather than written: the Himalaya and the world stand on the
 * same horizon, with the day's dispatches stacked between them. That is the
 * whole masthead promise — Nepal and the world, read together, at a glance.
 *
 * Inline SVG rather than a file in /public so it draws from the design tokens:
 * the flag and the summit are `--red`, the globe is `--green`, the range is
 * neutral. If the palette moves, the banner moves with it.
 *
 * Hidden from assistive tech: the wordmark and the tagline immediately beside
 * it already say "EkJhalak — Nepal & World, at a glance" in text, and a second
 * reading of the same sentence is noise rather than information.
 */
export function BrandBanner({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 360 120"
      aria-hidden="true"
      focusable="false"
      className={cn("h-16 w-48 xl:h-20 xl:w-60", className)}
    >
      {/* Plate. One step lighter than the canvas so it reads as mounted stock. */}
      <rect
        x="0.75"
        y="0.75"
        width="358.5"
        height="118.5"
        rx="12"
        fill="var(--surface)"
        stroke="var(--rule)"
        strokeWidth="1.5"
      />

      {/* Masthead flag — the coloured bar a paper puts beside its nameplate. */}
      <rect x="18" y="28" width="3.5" height="64" rx="1.75" fill="var(--red)" />

      {/* The shared horizon everything else stands on. */}
      <line
        x1="32"
        y1="92"
        x2="340"
        y2="92"
        stroke="var(--rule-strong)"
        strokeWidth="1.5"
      />

      {/* The range. */}
      <path
        d="M34 92 L58 66 L70 76 L94 46 L106 58 L124 30 L142 60 L154 50 L168 92 Z"
        fill="var(--rule-strong)"
      />
      {/* Summit, lit — the lead story of the day. */}
      <path d="M124 30 L136 44 L112 44 Z" fill="var(--red)" />

      {/* Dispatches, stacked newest-first. */}
      <rect x="184" y="52" width="56" height="3" rx="1.5" fill="var(--red)" />
      <rect
        x="184"
        y="64"
        width="40"
        height="3"
        rx="1.5"
        fill="var(--ink-muted)"
      />
      <rect
        x="184"
        y="76"
        width="50"
        height="3"
        rx="1.5"
        fill="var(--ink-muted)"
        opacity="0.6"
      />

      {/* The world, rising on the same line as the mountains. */}
      <g fill="none" stroke="var(--green)" strokeLinecap="round">
        <path d="M256 92 A36 36 0 0 1 328 92" strokeWidth="2" />
        <path
          d="M268 92 A24 36 0 0 1 316 92"
          strokeWidth="1.25"
          opacity="0.65"
        />
        <path
          d="M280 92 A12 36 0 0 1 304 92"
          strokeWidth="1.25"
          opacity="0.65"
        />
        <line
          x1="260.8"
          y1="74"
          x2="323.2"
          y2="74"
          strokeWidth="1.25"
          opacity="0.65"
        />
        <line
          x1="275.5"
          y1="60"
          x2="308.5"
          y2="60"
          strokeWidth="1.25"
          opacity="0.65"
        />
      </g>
    </svg>
  );
}
