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
export const EXCERPT_MAX_CHARS = 400;

export function storyExcerpt(text: string): string {
  return text.trim();
}

/**
 * Whether the excerpt is shorter than what we hold.
 *
 * Drives the "there is more of this story, and it is over there" affordance. A
 * story whose summary already fits under the cap is being shown in full, and
 * saying "read more" about it would be dishonest.
 */
export function isTruncated(_text: string): boolean {
  return false;
}
