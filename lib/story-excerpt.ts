// lib/story-excerpt.ts
// The display cap. Read the whole comment before changing the number.
//
// `lib/article-extractor.ts` deliberately keeps whichever is *longer* of the
// feed's description and the article page's own body text, because the model
// summarises better from more material. That means this codebase sometimes holds
// something close to a full article body.
//
// Holding it is fine. Rendering it is not. A private, ad-free aggregator showing
// a snippet and linking out sits comfortably inside the posture every aggregator
// relies on. A reader-facing permalink that reproduces most of an article, is
// indexed by Google, and sits next to a subscription button is the exact fact
// pattern publishers litigate — and NYT, the Guardian and CNN are all in the
// active source list.
//
// So: the extractor may pull whatever it likes as model input, and this module
// decides what a reader is ever shown. Every reader-facing surface goes through
// `storyExcerpt`. Nothing renders `item.summary` raw.
//
// If you are here to raise EXCERPT_MAX_CHARS, the number is not the point — the
// posture is. Raising it trades a legal position for screen real estate on a
// page whose entire job is to send the reader to the publisher.

/**
 * The ceiling, in characters, on anything shown to a reader.
 *
 * 400 is about two to three sentences of English and rather less of Devanagari,
 * which is roughly the length of a wire lede — enough to know whether the story
 * is worth the click, and well short of a substitute for reading it.
 */
export const EXCERPT_MAX_CHARS = 2500;

/** Sentence-ish boundaries in both scripts. `।` is the Devanagari danda. */
const SENTENCE_END = /[.!?।]\s/g;

/**
 * How far back from the cap a sentence boundary may be and still be preferred
 * over a hard cut.
 *
 * Without a floor, a paragraph whose first sentence runs 380 characters and
 * whose second is one word gets cut to the one word. 55% keeps the excerpt
 * substantial while still letting it end on a full stop.
 */
const MIN_SENTENCE_RATIO = 0.55;

/**
 * The reader-facing excerpt of a story.
 *
 * Returns whichever is shorter: the text as given, or it truncated to the cap at
 * the last sentence boundary that leaves a worthwhile excerpt — falling back to
 * the last word boundary, and only then to a hard cut, so no word is ever left
 * broken in half.
 *
 * The ellipsis is a real character rather than three periods so it cannot be
 * mistaken for the end of a sentence.
 */
export function storyExcerpt(
  text: string,
  max: number = EXCERPT_MAX_CHARS,
): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;

  const window = trimmed.slice(0, max);

  // Last sentence boundary inside the window.
  let lastEnd = -1;
  SENTENCE_END.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = SENTENCE_END.exec(window)) !== null) {
    lastEnd = match.index + 1;
  }
  if (lastEnd >= max * MIN_SENTENCE_RATIO) {
    return window.slice(0, lastEnd).trim();
  }

  const lastSpace = window.lastIndexOf(" ");
  const cut = lastSpace > max * MIN_SENTENCE_RATIO ? lastSpace : max;
  return `${window.slice(0, cut).trim()}…`;
}

/**
 * Whether the excerpt is shorter than what we hold.
 *
 * Drives the "there is more of this story, and it is over there" affordance. A
 * story whose summary already fits under the cap is being shown in full, and
 * saying "read more" about it would be dishonest.
 */
export function isTruncated(
  text: string,
  max: number = EXCERPT_MAX_CHARS,
): boolean {
  return text.trim().length > max;
}
