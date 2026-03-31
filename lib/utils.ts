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
  const now = new Date()
  
  if (range === "day") {
    return `Today • ${String(7 + (index % 12)).padStart(2, "0")}:${index % 2 === 0 ? "15" : "45"}`
  }
  
  if (range === "week") {
    // Go back 0-6 days from today
    const daysBack = index % 7
    const date = new Date(now)
    date.setDate(date.getDate() - daysBack)
    const hours = 8 + (index % 10)
    const minutes = index % 2 === 0 ? "00" : "30"
    return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} • ${String(hours).padStart(2, "0")}:${minutes}`
  }
  
  // month range
  const daysBack = index % 28
  const date = new Date(now)
  date.setDate(date.getDate() - daysBack)
  const hours = 8 + (index % 10)
  const minutes = index % 2 === 0 ? "00" : "30"
  return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} • ${String(hours).padStart(2, "0")}:${minutes}`
}
