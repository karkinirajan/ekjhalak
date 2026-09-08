import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTopicFallbackImageDataUrl,
  resolveStoryImageSource,
} from "./default-images";

test("buildTopicFallbackImageDataUrl creates a topic-based SVG image", () => {
  const url = buildTopicFallbackImageDataUrl("politics");
  const decoded = decodeURIComponent(
    url.replace(/^data:image\/svg\+xml;charset=UTF-8,/, ""),
  );

  assert.match(url, /^data:image\/svg\+xml/);
  assert.match(decoded, /Politics/);
  assert.match(decoded, /⚖/);
});

test("resolveStoryImageSource prefers the source image and otherwise uses topic art", () => {
  const sourceUrl = "https://example.com/photo.jpg";

  assert.equal(resolveStoryImageSource(sourceUrl, "sports"), sourceUrl);
  assert.match(
    resolveStoryImageSource(null, "politics"),
    /^data:image\/svg\+xml/,
  );
});

// The cover art is an <img>, so it is outside everything that guards colour on
// this site: check-contrast.mjs parses globals.css and never sees these values,
// and axe scans the DOM and sees an opaque image. Its label is real type on a
// real ground, and this is the only thing that checks it can be read.
const TOPICS = [
  "breaking", "politics", "world", "business", "sports",
  "technology", "health", "environment", "society",
] as const;

const srgb = (c: number) => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => srgb(parseInt(hex.slice(i, i + 2), 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

test("every generated cover prints its label at WCAG AA against its own ground", () => {
  for (const topic of TOPICS) {
    const svg = decodeURIComponent(
      buildTopicFallbackImageDataUrl(topic).replace(
        /^data:image\/svg\+xml;charset=UTF-8,/,
        "",
      ),
    );

    const ground = svg.match(/<rect width="800" height="800" fill="(#[0-9a-f]{6})"/)?.[1];
    const label = svg.match(/font-size="62"[^>]*fill="(#[0-9a-f]{6})"/)?.[1];
    assert.ok(ground && label, `${topic}: could not read the cover's colours`);

    const ratio = contrast(label, ground);
    assert.ok(
      ratio >= 4.5,
      `${topic}: label ${label} on ${ground} is ${ratio.toFixed(2)}:1, under 4.5:1`,
    );
  }
});

test("no two topics generate the same cover", () => {
  const seen = new Map<string, string>();
  for (const topic of TOPICS) {
    const art = buildTopicFallbackImageDataUrl(topic);
    const clash = seen.get(art);
    assert.equal(clash, undefined, `${topic} and ${clash} render an identical cover`);
    seen.set(art, topic);
  }
});
