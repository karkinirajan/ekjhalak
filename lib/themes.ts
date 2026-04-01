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
    name: "Night Ink",
    // ── Night Ink ─────────────────────────────────────────────────────────
    // Deep blue-black shell. Ivory text on near-black backgrounds.
    // Indigo accent — familiar for news products, easy on the eye at night.
    app:   "bg-[#080c12] text-[#edf0f7]",
    shell: "bg-[#0f1520] border-[#1e2a3a]",
    panel: "bg-[#080c12] border-[#1e2a3a]",
    soft:  "bg-[#161f2e] border-[#1e2a3a]",
    card:  "bg-[#0f1520] border-[#1e2a3a] hover:border-[#334155] hover:shadow-lg hover:shadow-black/40 transition-all duration-150",
    // Text tiers — same base colour, descending opacity
    text:    "text-[#edf0f7]",
    subtext: "text-[#edf0f7]/[.68]",
    muted:   "text-[#edf0f7]/[.42]",
    input:
      "bg-[#080c12] border-[#1e2a3a] text-[#edf0f7] placeholder:text-[#edf0f7]/25 focus:border-[#5b6cf8] focus:ring-1 focus:ring-[#5b6cf8]/20",
    // Indigo-500 accent — higher chroma than #4f46e5 for better readability
    accent:
      "bg-[#4f5dff] text-white hover:bg-[#404cdb] shadow-sm shadow-indigo-950/50",
    ghost:
      "bg-[#161f2e] text-[#edf0f7]/75 hover:bg-[#1e2a3a] border border-[#1e2a3a]",
    badge:   "bg-[#1e2745]/60 text-[#93a8f4] border-[#3d52a0]/40",
    page:    "from-[#04060a] via-[#080c12] to-[#080c12]",
    image:   "bg-[#161f2e]",
  },

  light: {
    name: "Clean Slate",
    // ── Clean Slate ───────────────────────────────────────────────────────
    // Warm off-white canvas — less harsh than pure white.
    // Slate-charcoal text keeps reading comfortable for long sessions.
    // Blue accent for interactive elements — clear, accessible.
    app:   "bg-[#f5f6f8] text-[#1a2130]",
    shell: "bg-[#ffffff] border-[#dde1e8] shadow-sm",
    panel: "bg-[#f5f6f8] border-[#dde1e8]",
    soft:  "bg-[#eaecf0] border-[#dde1e8]",
    card:  "bg-[#ffffff] border-[#dde1e8] hover:border-[#9baec8] hover:shadow-md hover:shadow-slate-200/70 transition-all duration-150",
    // Text tiers — charcoal base, descending opacity
    text:    "text-[#1a2130]",
    subtext: "text-[#1a2130]/[.68]",
    muted:   "text-[#1a2130]/[.46]",
    input:
      "bg-[#ffffff] border-[#cdd2db] text-[#1a2130] placeholder:text-[#1a2130]/32 focus:border-[#3b5cf8] focus:ring-1 focus:ring-[#3b5cf8]/15",
    // Royal blue — punchy but not aggressive on the light canvas
    accent:
      "bg-[#3b5cf8] text-white hover:bg-[#2d4ee0] shadow-sm shadow-blue-300/25",
    ghost:
      "bg-[#ffffff] text-[#1a2130]/72 hover:bg-[#eaecf0] border border-[#dde1e8]",
    badge:   "bg-[#eff2fd] text-[#2d4ee0] border-[#c7d0f5]/80",
    page:    "from-[#eaecf0]/60 via-[#f5f6f8] to-[#f5f6f8]",
    image:   "bg-[#eaecf0]",
  },
} as const;

export type ThemePalette = (typeof themes)[ThemeName];
