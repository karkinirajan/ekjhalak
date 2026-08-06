import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { decodeEntities, htmlToText } from "./html-entities";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function truncate(text: string, maxLength: number) {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}…`;
}

/**
 * Decode HTML entities for clean display.
 *
 * The hand-written chain this replaces finished with `.replace(/&#\d+;/g, " ")`,
 * which turned every numeric entity it had not listed into a space. That is
 * lossy for Latin punctuation and total for Devanagari: text that arrives
 * entity-encoded — which some Nepali newsrooms serve — came out as a row of
 * blanks. The shared decoder resolves entities by code point instead, so it
 * covers every script without a lookup table.
 */
export function sanitizeTextForDisplay(text: string): string {
  if (!text) return "";
  // Decode, then strip — and both, in that order.
  //
  // This used to decode only. That is correct for entities and silently wrong
  // for markup: a publisher whose og:description holds `&lt;p&gt;` decoded to a
  // real `<p>`, React escaped it on render as it should, and the reader saw the
  // characters `<p>` printed in the middle of the story. Stripping first would
  // not have helped, because at that point the tag was still escaped.
  //
  // Every reader-facing surface calls this, so it is the last line of defence
  // rather than the only one — the extractor and the enrichment pass both clean
  // their own output. A source that starts leaking markup tomorrow still cannot
  // print a tag to a reader.
  return htmlToText(decodeEntities(text));
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
 * Returns a human-readable label for how long ago a unix-ms timestamp was,
 * in the reader's chosen language.
 */
export function formatRelativeTime(
  timestampMs: number,
  lang: "en" | "np",
  now: number,
): string {
  const diffMin = Math.max(0, Math.floor((now - timestampMs) / 60_000));

  if (lang === "np") {
    if (diffMin < 1) return "भर्खरै";
    if (diffMin < 60) return `${diffMin} मिनेट अघि`;
    const hours = Math.floor(diffMin / 60);
    if (hours < 24) return `${hours} घण्टा अघि`;
    return `${Math.floor(hours / 24)} दिन अघि`;
  }

  if (diffMin < 1) return "Just now";
  if (diffMin === 1) return "1 min ago";
  if (diffMin < 60) return `${diffMin} min ago`;
  const hours = Math.floor(diffMin / 60);
  if (hours === 1) return "1 hour ago";
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "Yesterday" : `${days} days ago`;
}

/**
 * Rough reading time in whole minutes, floored at 1.
 * 200 wpm is the usual prose estimate; Devanagari splits on spaces the same way.
 */
export function readingTime(text: string): number {
  if (!text) return 1;
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

/**
 * Publication initials for the source monogram — "The Kathmandu Post" → "KP".
 * Leading articles are dropped so "The Hindu" and "The Himalayan Times" don't
 * both collapse to "TH".
 */
export function sourceMonogram(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((word, index) => !(index === 0 && /^(the|la|le|el)$/i.test(word)));

  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
