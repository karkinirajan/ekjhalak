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
    name: "Warm Parchment",
    // ── Warm Parchment ────────────────────────────────────────────────────
    // Solarized-inspired warm amber cream — the classic eye-friendly reading
    // background.  Espresso-brown text on golden parchment; amber accent.
    app: "bg-[#fdf6e3] text-[#2d1b0e]",
    shell: "bg-[#fffef5] border-[#e3d5b8] shadow-sm",
    panel: "bg-[#fdf8ec] border-[#e3d5b8]",
    soft: "bg-[#f5e9cc] border-[#e3d5b8]",
    card: "bg-[#fffef5] border-[#e3d5b8] hover:border-[#c9a96e] hover:shadow-sm hover:shadow-amber-100/60",
    // Primary text — deep espresso brown, high contrast on the warm bg
    text: "text-[#2d1b0e]",
    // Secondary text — same brown at 68 % → warm and comfortable
    subtext: "text-[#2d1b0e]/[.68]",
    // Metadata / labels — same brown at 46 % → gentle, never grey
    muted: "text-[#2d1b0e]/[.46]",
    input:
      "bg-[#fffef5] border-[#d8c9a8] text-[#2d1b0e] placeholder:text-[#2d1b0e]/35 focus:border-[#b45309] focus:ring-1 focus:ring-[#b45309]/20",
    // Amber-gold accent fits the warm palette perfectly
    accent:
      "bg-[#b45309] text-white hover:bg-[#92400e] shadow-sm shadow-amber-300/40",
    ghost:
      "bg-[#fffef5] text-[#2d1b0e]/75 hover:bg-[#f5e9cc] border border-[#e3d5b8]",
    badge: "bg-[#fef3c7] text-[#92400e] border-[#fcd34d]/70",
    page: "from-[#f5e9cc]/50 via-[#fdf6e3] to-[#fdf6e3]",
    image: "bg-[#f5e9cc]",
  },
} as const;

export type ThemePalette = (typeof themes)[ThemeName];
