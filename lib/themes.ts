export type ThemeName = "dark" | "light";

// Base text tokens for each theme — used to derive opacity tiers.
// Both themes use a single base colour and apply Tailwind opacity modifiers
// (/75, /55) so the text hierarchy is cohesive and always readable.

export const themes = {
  dark: {
    name: "Night Ink",
    // ── Night Ink ─────────────────────────────────────────────────────────
    // Deep blue-black shell, high-contrast ivory text.
    // Opacity tiers instead of distinct muted colours → visually unified.
    app: "bg-[#0c1018] text-[#eef1f6]",
    shell: "bg-[#141922] border-[#232e40]",
    panel: "bg-[#0c1018] border-[#232e40]",
    soft: "bg-[#1c2535] border-[#232e40]",
    card: "bg-[#141922] border-[#232e40] hover:border-[#3d4e66] hover:shadow-md hover:shadow-black/25",
    // Primary text — full opacity ivory
    text: "text-[#eef1f6]",
    // Secondary text — same ivory at 72 % → clearly readable, clearly secondary
    subtext: "text-[#eef1f6]/[.72]",
    // Metadata / labels — same ivory at 48 % → still scannable, unobtrusive
    muted: "text-[#eef1f6]/[.48]",
    input:
      "bg-[#0c1018] border-[#232e40] text-[#eef1f6] placeholder:text-[#eef1f6]/30 focus:border-[#6366f1]",
    accent:
      "bg-[#4f46e5] text-white hover:bg-[#4338ca] shadow-sm shadow-indigo-900/30",
    ghost:
      "bg-[#1c2535] text-[#eef1f6]/80 hover:bg-[#232e40] border border-[#232e40]",
    badge: "bg-[#312e81]/30 text-[#a5b4fc] border-[#4f46e5]/30",
    page: "from-[#07090e] via-[#0c1018] to-[#0c1018]",
    image: "bg-[#1c2535]",
  },
  light: {
    name: "Clean Slate",
    // ── Clean Slate ───────────────────────────────────────────────────────
    // Neutral cool-gray palette — crisp, modern reading surface with
    // slate-charcoal text and a blue-gray accent.
    app: "bg-[#f8f9fb] text-[#1e2631]",
    shell: "bg-[#ffffff] border-[#e2e5ea] shadow-sm",
    panel: "bg-[#f8f9fb] border-[#e2e5ea]",
    soft: "bg-[#eef0f3] border-[#e2e5ea]",
    card: "bg-[#ffffff] border-[#e2e5ea] hover:border-[#b0b8c4] hover:shadow-sm hover:shadow-gray-200/60",
    // Primary text — deep charcoal, high contrast on white
    text: "text-[#1e2631]",
    // Secondary text — same charcoal at 70 %
    subtext: "text-[#1e2631]/[.70]",
    // Metadata / labels — same charcoal at 48 %
    muted: "text-[#1e2631]/[.48]",
    input:
      "bg-[#ffffff] border-[#d1d5db] text-[#1e2631] placeholder:text-[#1e2631]/35 focus:border-[#4f6ef7] focus:ring-1 focus:ring-[#4f6ef7]/20",
    // Cool blue accent on a neutral canvas
    accent:
      "bg-[#4f6ef7] text-white hover:bg-[#3b5de5] shadow-sm shadow-blue-300/30",
    ghost:
      "bg-[#ffffff] text-[#1e2631]/75 hover:bg-[#eef0f3] border border-[#e2e5ea]",
    badge: "bg-[#eef0f7] text-[#3b5de5] border-[#c7d0ea]/70",
    page: "from-[#eef0f3]/50 via-[#f8f9fb] to-[#f8f9fb]",
    image: "bg-[#eef0f3]",
  },
} as const;

export type ThemePalette = (typeof themes)[ThemeName];
