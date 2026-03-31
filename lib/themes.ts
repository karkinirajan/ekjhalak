export type ThemeName = "dark" | "light"

export const themes = {
  dark: {
    name: "GitHub Dark",
    // GitHub Dark theme colors
    app: "bg-[#0d1117] text-[#c9d1d9]",
    shell: "bg-[#161b22] border-[#30363d]",
    panel: "bg-[#0d1117] border-[#30363d]",
    soft: "bg-[#21262d] border-[#30363d]",
    card: "bg-[#161b22] border-[#30363d] hover:border-[#8b949e]",
    text: "text-[#c9d1d9]",
    subtext: "text-[#8b949e]",
    muted: "text-[#6e7681]",
    input: "bg-[#0d1117] border-[#30363d] text-[#c9d1d9] placeholder:text-[#6e7681] focus:border-[#58a6ff]",
    accent: "bg-[#238636] text-white hover:bg-[#2ea043] shadow-none",
    ghost: "bg-[#21262d] text-[#c9d1d9] hover:bg-[#30363d] border border-[#30363d]",
    badge: "bg-[#1f6feb]/20 text-[#58a6ff] border-[#58a6ff]/40",
    page: "from-[#010409] via-[#0d1117] to-[#0d1117]",
  },
  light: {
    name: "Daylight",
    app: "bg-gray-50 text-gray-900",
    shell: "bg-white/90 border-gray-200 shadow-sm",
    panel: "bg-white/80 border-gray-200",
    soft: "bg-gray-100/80 border-gray-200",
    card: "bg-white border-gray-200 hover:border-gray-300 shadow-sm",
    text: "text-gray-900",
    subtext: "text-gray-600",
    muted: "text-gray-500",
    input: "bg-white border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500",
    accent: "bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-900/10",
    ghost: "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200",
    badge: "bg-blue-50 text-blue-700 border-blue-200",
    page: "from-blue-50/50 via-gray-50 to-gray-50",
  },
} as const

export type ThemePalette = (typeof themes)[ThemeName]
