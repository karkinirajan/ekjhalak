import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function truncate(text: string, maxLength: number) {
  if (!text) return ""
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength).trim()}…`
}

export function buildPublishedAt(range: string, index: number) {
  if (range === "day") return `Today • ${String(7 + (index % 12)).padStart(2, "0")}:${index % 2 === 0 ? "15" : "45"}`
  if (range === "week") return `This week • Day ${1 + (index % 7)}`
  return `This month • Week ${1 + (index % 4)}`
}
