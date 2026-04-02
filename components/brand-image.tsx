import { cn } from "@/lib/utils";

interface BrandImageProps {
  containerClassName?: string;
  imageClassName?: string;
  priority?: boolean;
}

/**
 * Inline SVG brand identity for Ek Jhalak.
 *
 * Rendered as a React SVG element (not <img>) so that:
 *  - CSS fonts loaded by next/font (Noto Sans Devanagari, Inter) apply to text elements
 *  - currentColor inherits the parent's text color for theme-aware subtitle rendering
 *  - No network request; scales perfectly at any size
 *  - Works on both dark and light theme backgrounds
 *
 * Mark anatomy:
 *  • Gradient circle  — indigo (#6366f1) → violet (#7c3aed)
 *  • Lens / aperture  — two bezier arcs symbolising "jhalak" (glimpse)
 *  • White pupil      — focus point with gradient core
 *  • Catchlight dot   — adds depth and life to the mark
 *
 * Wordmark:
 *  • "एक झलक"   — bold Noto Sans Devanagari, gradient fill (primary)
 *  • "EK JHALAK" — Inter, tracked, muted currentColor (secondary)
 */
export function BrandImage({
  containerClassName,
  imageClassName,
}: BrandImageProps) {
  return (
    <div
      className={cn(
        "flex w-full items-center justify-center overflow-visible px-3 py-2 sm:px-4 sm:py-3",
        containerClassName,
      )}
    >
      <svg
        viewBox="0 0 260 68"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="एक झलक — Ek Jhalak"
        className={cn(
          "block h-auto max-h-full w-auto max-w-full select-none",
          imageClassName,
        )}
      >
        <defs>
          {/* Brand gradient: indigo → violet */}
          <linearGradient id="ej-g1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>
          {/* Horizontal wordmark gradient */}
          <linearGradient id="ej-g2" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>

        {/* ── Mark ───────────────────────────────────────────── */}
        {/* Ambient glow ring */}
        <circle cx="34" cy="34" r="33" fill="#6366f1" opacity="0.1" />
        {/* Main gradient circle */}
        <circle cx="34" cy="34" r="29" fill="url(#ej-g1)" />
        {/* Lens / aperture — two bezier arcs forming an eye  */}
        <path
          d="M8 34 C15 16 53 16 60 34 C53 52 15 52 8 34Z"
          fill="none"
          stroke="white"
          strokeWidth="1.75"
          strokeLinejoin="round"
          opacity="0.65"
        />
        {/* Iris ring */}
        <circle cx="34" cy="34" r="10" fill="white" opacity="0.1" />
        {/* White sclera */}
        <circle cx="34" cy="34" r="6.5" fill="white" opacity="0.93" />
        {/* Pupil — gradient core */}
        <circle cx="34" cy="34" r="3.75" fill="url(#ej-g1)" />
        {/* Catchlight highlight */}
        <circle cx="28.5" cy="28.5" r="1.75" fill="white" opacity="0.55" />

        {/* ── Wordmark ────────────────────────────────────────── */}
        {/* Primary: Devanagari name */}
        <text
          x="76"
          y="40"
          fontFamily="'Noto Sans Devanagari', 'Mangal', 'Kokila', 'Arial Unicode MS', system-ui, sans-serif"
          fontSize="26"
          fontWeight="700"
          fill="url(#ej-g2)"
        >
          एक झलक
        </text>
        {/* Secondary: tracked Latin label — inherits parent text color */}
        <text
          x="78"
          y="57"
          fontFamily="'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
          fontSize="8.5"
          fontWeight="500"
          letterSpacing="4"
          fill="currentColor"
          opacity="0.38"
        >
          EK JHALAK
        </text>
      </svg>
    </div>
  );
}
