export type ThemeName = "dark" | "light";

// ── Design philosophy ─────────────────────────────────────────────────────────
//
// Both themes aim for premium editorial readability:
//   • A restrained 3-tier text hierarchy (primary / secondary / meta)
//   • Generous contrast between surface layers
//   • Accent colors that feel deliberate, not garish
//   • Identical semantic structure so component code never needs to branch
//
// All color values are hand-picked for WCAG AA contrast on their background.

export const themes = {
  dark: {
    name: "Signal Night",
    app: "bg-[#0c1220] text-[#f2f6ff]",
    shell:
      "bg-[#121a2d]/95 border-[#25304a] shadow-[0_14px_40px_rgba(3,7,18,0.45)]",
    panel: "bg-[#121a2d] border-[#26334f]",
    soft: "bg-[#1a2440] border-[#2c3b59]",
    card: "bg-[#101a2f] border-[#24324f] hover:border-[#d63434]/60 hover:shadow-[0_10px_24px_rgba(6,13,28,0.55)] transition-all duration-200",
    text: "text-[#f2f6ff]",
    subtext: "text-[#dce6ff]/85",
    muted: "text-[#b9caef]/75",
    input:
      "bg-[#0f182b] border-[#2a3752] text-[#f2f6ff] placeholder:text-[#a8bbdf]/55 focus:border-[#d63434] focus:ring-1 focus:ring-[#d63434]/25",
    accent:
      "bg-[#c53030] text-white hover:bg-[#aa2a2a] border border-[#e26f6f] shadow-sm shadow-black/45",
    ghost:
      "bg-[#16223a] text-[#dce6ff] hover:bg-[#223252] border border-[#33476e]",
    badge: "bg-[#0f2f2a] text-[#9de5cd] border-[#256557]",
    page: "from-[#080f1d] via-[#0d1528] to-[#131e36]",
    image: "bg-[#17223b]",
  },

  light: {
    name: "Sunrise Wire",
    app: "bg-[#fff8f1] text-[#1b2435]",
    shell:
      "bg-[#fffdfb]/95 border-[#ffd7bc] shadow-[0_12px_30px_rgba(255,114,43,0.14)]",
    panel: "bg-[#fff4eb] border-[#ffdbbf]",
    soft: "bg-[#ffe9d7] border-[#ffd5b3]",
    card: "bg-[#fffdfa] border-[#ffd8bb] hover:border-[#cd3a3a]/65 hover:shadow-[0_12px_22px_rgba(255,117,46,0.18)] transition-all duration-200",
    text: "text-[#1b2435]",
    subtext: "text-[#2e3a53]/86",
    muted: "text-[#4c5a75]/74",
    input:
      "bg-[#fffdf9] border-[#ffcfa8] text-[#1b2435] placeholder:text-[#6a758f]/62 focus:border-[#c53030] focus:ring-1 focus:ring-[#c53030]/20",
    accent:
      "bg-[#c53030] text-white hover:bg-[#aa2a2a] border border-[#d87777] shadow-sm shadow-[#dba28f]/35",
    ghost:
      "bg-[#fffdf9] text-[#2e3a53] hover:bg-[#ffe8d6] border border-[#f2b48a]",
    badge: "bg-[#e9f8f1] text-[#1f6a4f] border-[#97cdb7]",
    page: "from-[#ffe5d3]/55 via-[#fff7ee] to-[#fffaf3]",
    image: "bg-[#ffe8d7]",
  },
} as const;

export type ThemePalette = (typeof themes)[ThemeName];
