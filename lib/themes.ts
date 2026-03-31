export type ThemeName = "dark" | "light"

export const themes = {
  dark: {
    name: "Night Ink",
    app: "bg-[#0a1020] text-slate-100",
    shell: "bg-slate-950/65 border-white/10",
    panel: "bg-white/[0.045] border-white/10",
    soft: "bg-white/[0.035] border-white/10",
    card: "bg-white/[0.04] border-white/10 hover:bg-white/[0.06]",
    text: "text-slate-100",
    subtext: "text-slate-300/80",
    muted: "text-slate-400/75",
    input: "bg-white/[0.04] border-white/10 text-slate-100 placeholder:text-slate-500",
    accent: "bg-cyan-400 text-slate-950 hover:bg-cyan-300",
    ghost: "bg-white/[0.05] text-slate-200 hover:bg-white/[0.09]",
    badge: "bg-cyan-400/15 text-cyan-200 border-cyan-400/20",
    page: "from-cyan-500/10 via-blue-500/5 to-transparent",
  },
  light: {
    name: "Paper Dusk",
    app: "bg-[#ece8e1] text-slate-900",
    shell: "bg-white/75 border-slate-300/70",
    panel: "bg-white/70 border-slate-300/70",
    soft: "bg-white/60 border-slate-300/60",
    card: "bg-white/85 border-slate-300/70 hover:bg-white",
    text: "text-slate-900",
    subtext: "text-slate-700/85",
    muted: "text-slate-500/90",
    input: "bg-white/90 border-slate-300/80 text-slate-800 placeholder:text-slate-400",
    accent: "bg-slate-900 text-white hover:bg-slate-800",
    ghost: "bg-white/80 text-slate-700 hover:bg-white",
    badge: "bg-slate-900/5 text-slate-700 border-slate-400/30",
    page: "from-slate-400/10 via-stone-300/10 to-transparent",
  },
} as const

export type ThemePalette = (typeof themes)[ThemeName]
