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
 * Decode common HTML entities and remove unresolved tokens for clean display.
 */
export function sanitizeTextForDisplay(text: string): string {
  if (!text) return "";
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&apos;|&lsquo;|&rsquo;/gi, "'")
    .replace(/&ndash;/gi, "-")
    .replace(/&mdash;/gi, " - ")
    .replace(/&hellip;/gi, "…")
    .replace(/&#x2018;|&#x2019;|&#8216;|&#8217;/gi, "'")
    .replace(/&#x201c;|&#x201d;|&#8220;|&#8221;/gi, '"')
    .replace(/&#x2026;|&#8230;/gi, "…")
    .replace(/&#\d+;/g, " ")
    .replace(/&#x[0-9a-f]+;/gi, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
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
