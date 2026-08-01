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
