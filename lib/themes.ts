export type ThemeName = "dark" | "light";

// ── Design philosophy ─────────────────────────────────────────────────────────
//
// Dark: GitHub Dark Default — canvas #0d1117, overlay #161b22, border #30363d,
// foreground #e6edf3, accent #2f81f7. Calm, editorial, WCAG AA.
// Light: unchanged — warm parchment, preserved across this refresh.
//
// Both themes share semantic keys so component code never branches on name.

export const themes = {
  dark: {
    name: "GitHub Dark",
    app: "bg-[#0d1117] text-[#e6edf3]",
    shell: "bg-[#161b22] border-[#30363d] shadow-[0_1px_0_rgba(255,255,255,0.02)]",
    panel: "bg-[#161b22] border-[#30363d]",
    soft: "bg-[#21262d] border-[#30363d]",
    card: "bg-[#161b22] border-[#30363d] hover:border-[#6e7681] hover:bg-[#1c2128] transition-colors duration-200",
    text: "text-[#e6edf3]",
    subtext: "text-[#c9d1d9]",
    muted: "text-[#8b949e]",
    input:
      "bg-[#0d1117] border-[#30363d] text-[#e6edf3] placeholder:text-[#6e7681] focus:border-[#2f81f7] focus:ring-1 focus:ring-[#2f81f7]/40",
    accent:
      "bg-[#2f81f7] text-white hover:bg-[#1f6feb] border border-transparent shadow-none",
    ghost:
      "bg-[#21262d] text-[#c9d1d9] hover:bg-[#30363d] border border-[#30363d]",
    badge: "bg-[#121d2f] text-[#79c0ff] border-[#1f4776]",
    page: "",
    image: "bg-[#21262d]",
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
