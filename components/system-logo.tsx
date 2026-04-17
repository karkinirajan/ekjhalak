import { cn } from "@/lib/utils";

interface SystemLogoProps {
  themeMode: "dark" | "light";
  className?: string;
  compact?: boolean;
}

/**
 * Theme-aware brand mark designed to blend with the app palette in both modes.
 */
export function SystemLogo({
  themeMode,
  className,
  compact = false,
}: SystemLogoProps) {
  const isDark = themeMode === "dark";

  const bg = isDark ? "#16223a" : "#fffaf4";
  const border = isDark ? "#33476e" : "#f2b48a";
  const glow = isDark ? "#0f182b" : "#fff1e5";
  const red = "#c53030";
  const redSoft = isDark ? "#e26f6f" : "#d87777";
  const ink = isDark ? "#dce6ff" : "#1d3357";
  const mint = isDark ? "#9de5cd" : "#1f6a4f";

  return (
    <div
      className={cn(
        "inline-flex items-center",
        compact ? "gap-0" : "gap-2",
        className,
      )}
      aria-label="EJKN"
      role="img"
    >
      <svg viewBox="0 0 64 64" className="h-14 w-14" aria-hidden="true">
        <rect
          x="2"
          y="2"
          width="60"
          height="60"
          rx="16"
          fill={bg}
          stroke={border}
          strokeWidth="2"
        />
        <rect
          x="8"
          y="8"
          width="48"
          height="48"
          rx="12"
          fill={glow}
          opacity="0.7"
        />

        <path
          d="M16 34c3-8 10-12 16-12s13 4 16 12c-3 8-10 12-16 12s-13-4-16-12Z"
          fill="none"
          stroke={red}
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <circle cx="32" cy="34" r="7" fill={ink} />
        <circle cx="32" cy="34" r="4" fill={red} />
        <circle cx="28.5" cy="30.5" r="1.4" fill="#ffffff" opacity="0.75" />

        <path
          d="M12 51h22"
          stroke={redSoft}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M37 51h15"
          stroke={mint}
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
