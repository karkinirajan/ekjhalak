import assert from "node:assert/strict";
import test from "node:test";

import { buildTopicFallbackImageDataUrl } from "./default-images";

test("buildTopicFallbackImageDataUrl creates a topic-based SVG image", () => {
    const url = buildTopicFallbackImageDataUrl("politics");
    const decoded = decodeURIComponent(url.replace(/^data:image\/svg\+xml;charset=UTF-8,/, ""));

    assert.match(url, /^data:image\/svg\+xml/);
    assert.match(decoded, /Politics/);
    assert.match(decoded, /⚖/);
});
