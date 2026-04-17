import { cn } from "@/lib/utils";

interface BrandImageProps {
  containerClassName?: string;
  imageClassName?: string;
  priority?: boolean;
}

/**
 * Inline SVG brand identity for EkJhalak News (EJKN).
 * Uses a solid red editorial mark with defined borders for crisp rendering.
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
        viewBox="0 0 360 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="EJKN — EkJhalak News"
        className={cn(
          "block h-auto max-h-full w-auto max-w-full select-none",
          imageClassName,
        )}
      >
        <path
          d="M 22 4 H 340 A 16 16 0 0 1 356 20 V 100 A 12 12 0 0 1 344 112 H 16 A 12 12 0 0 1 4 100 V 22 A 18 18 0 0 1 22 4 Z"
          fill="#fffdf8"
          stroke="#8f1f1f"
          strokeWidth="2"
        />

        <g transform="translate(10 10) scale(1.625)">
          <rect
            x="3"
            y="3"
            width="58"
            height="58"
            rx="16"
            fill="#c53030"
            stroke="#8f1f1f"
            strokeWidth="2"
          />
          <rect
            x="8"
            y="8"
            width="48"
            height="48"
            rx="12"
            fill="white"
            fillOpacity="0.14"
            stroke="white"
            strokeOpacity="0.24"
          />
          <text
            x="32"
            y="40"
            textAnchor="middle"
            fontFamily="Sora, Segoe UI, Arial, sans-serif"
            fontSize="21"
            fontWeight="700"
            letterSpacing="0.8"
            fill="white"
          >
            EJKN
          </text>
        </g>

        <text
          x="60"
          y="72"
          textAnchor="middle"
          fontFamily="'Sora', 'Segoe UI', system-ui, sans-serif"
          fontSize="34"
          fontWeight="700"
          fill="white"
          letterSpacing="1"
        >
          EJKN
        </text>

        <text
          x="128"
          y="58"
          fontFamily="'Noto Sans Devanagari', 'Mangal', 'Kokila', 'Arial Unicode MS', system-ui, sans-serif"
          fontSize="34"
          fontWeight="700"
          fill="#1f6a4f"
        >
          एक झलक
        </text>

        <text
          x="130"
          y="86"
          fontFamily="'Sora', 'Segoe UI', system-ui, sans-serif"
          fontSize="12"
          fontWeight="600"
          letterSpacing="2.8"
          fill="#1f6a4f"
          opacity="0.7"
        >
          EKJHALAK NEWS
        </text>
      </svg>
    </div>
  );
}
