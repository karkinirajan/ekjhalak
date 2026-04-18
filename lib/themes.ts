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
    name: "Graphite Night",
    app: "bg-[#1e1f1d] text-[#f2f2f4]",
    shell:
      "bg-[#252527] border-[#3a3a3e] shadow-[0_1px_0_rgba(255,255,255,0.03)]",
    panel: "bg-[#252527] border-[#3a3a3e]",
    soft: "bg-[#252527] border-[#444449]",
    card: "bg-[#252527] border-[#3a3a3e] hover:border-[#5a5a61] hover:bg-[#2b2b2e] transition-colors duration-200",
    text: "text-[#f2f2f4]",
    subtext: "text-[#dddddf]",
    muted: "text-[#b7b7be]",
    input:
      "bg-[#252527] border-[#4a4a51] text-[#f2f2f4] placeholder:text-[#a0a0a8] focus:border-[#4f9dff] focus:ring-1 focus:ring-[#4f9dff]/40",
    accent:
      "bg-[#4f9dff] text-[#081322] hover:bg-[#72b0ff] border border-transparent shadow-none",
    ghost:
      "bg-[#252527] text-[#dddddf] hover:bg-[#2f2f33] border border-[#444449]",
    badge: "bg-[#1d2b3f] text-[#9bc8ff] border-[#365a86]",
    page: "",
    image: "bg-[#252527]",
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
