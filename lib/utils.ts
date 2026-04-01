import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function truncate(text: string, maxLength: number) {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}…`;
}

/**
 * Splits a block of text into up to `max` paragraphs at sentence boundaries.
 * Handles both English (. ! ?) and Nepali (।) sentence terminators.
 * Short text (<280 chars) is returned as-is.
 */
export function splitIntoParagraphs(text: string, max = 3): string[] {
  if (!text?.trim()) return [];
  const t = text.trim();
  if (t.length < 280) return [t];

  // Split on sentence boundaries while keeping the terminator attached
  const sentences = t
    .split(/(?<=[.।!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentences.length <= 1) return [t];
  if (sentences.length <= max) return sentences;

  // Merge into at most `max` evenly-sized groups
  const result: string[] = [];
  const groupSize = Math.ceil(sentences.length / max);
  for (let i = 0; i < max; i++) {
    const group = sentences
      .slice(i * groupSize, (i + 1) * groupSize)
      .join(" ")
      .trim();
    if (group) result.push(group);
  }
  return result;
}

/**
 * Returns a human-readable label for how long ago a unix-ms timestamp was.
 * Used in the "last updated" indicator.
 */
export function formatRelativeTime(timestampMs: number): string {
  const diffMs = Date.now() - timestampMs;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "Just now";
  if (diffMin === 1) return "1 min ago";
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr === 1) return "1 hour ago";
  return `${diffHr} hours ago`;
}
