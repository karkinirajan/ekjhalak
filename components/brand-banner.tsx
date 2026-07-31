import { cn } from "@/lib/utils";

/**
 * The nameplate banner — a 1:2 plate that sits beside the wordmark.
 *
 * Two bands sharing one rule. Above it, the mark: the Himalaya and the world
 * standing on the same horizon with the day's dispatches stacked between them,
 * which is the masthead promise drawn rather than written. Below it, the brand
 * lockup in both scripts.
 *
 * Inline SVG rather than a file in /public so it draws from the design tokens
 * and the loaded typefaces: the flag and the lit summit are `--red`, the globe
 * is `--green`, the name is set in the same Fraunces and Mukta as the page. If
 * the palette or the type stack moves, the banner moves with it.
 *
 * Both scripts appear regardless of the reader's language, because a bilingual
 * paper's nameplate is the one place that should always show it is bilingual.
 *
 * Hidden from assistive tech: the <h1> wordmark immediately beside it already
 * carries the same two names as text, and a second reading is noise.
 */
export function BrandBanner({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 480 240"
      aria-hidden="true"
      focusable="false"
      className={cn("h-24 w-48 xl:h-28 xl:w-56", className)}
    >
      {/* Plate. One step lighter than the canvas so it reads as mounted stock. */}
      <rect
        x="1"
        y="1"
        width="478"
        height="238"
        rx="18"
        fill="var(--surface)"
        stroke="var(--rule)"
        strokeWidth="2"
      />

      {/* ── Mark ─────────────────────────────────────────────────────────── */}

      {/* Masthead flag — the coloured bar a paper puts beside its nameplate. */}
      <rect x="34" y="36" width="5" height="68" rx="2.5" fill="var(--red)" />

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
      <path d="M146 34 L160 52 L132 52 Z" fill="var(--red)" />

      {/* Dispatches, stacked newest-first. */}
      <rect x="216" y="56" width="64" height="4" rx="2" fill="var(--red)" />
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
      <g fill="none" stroke="var(--green)" strokeLinecap="round">
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

      {/* ── Lockup ───────────────────────────────────────────────────────── */}

      <text
        x="240"
        y="176"
        textAnchor="middle"
        fill="var(--ink)"
        fontFamily='var(--font-display), Georgia, "Times New Roman", serif'
        fontSize="52"
        fontWeight="900"
        letterSpacing="-1.8"
        style={{ fontVariationSettings: '"SOFT" 80, "WONK" 0, "opsz" 90' }}
      >
        EkJhalak
      </text>

      <text
        x="240"
        y="208"
        textAnchor="middle"
        fill="var(--red)"
        fontFamily='var(--font-devanagari), "Noto Sans Devanagari", sans-serif'
        fontSize="24"
        fontWeight="600"
      >
        एक झलक
      </text>
    </svg>
  );
}
