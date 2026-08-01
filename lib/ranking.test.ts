import assert from "node:assert/strict";
import test from "node:test";

import { diversifyBySource, scoreStory, selectHero, selectTicker, selectTrending } from "./ranking";
import type { NewsItem } from "./news-pipeline";

const makeItem = (overrides: Partial<NewsItem> = {}): NewsItem => ({
    id: "item-1",
    bucket: "national",
    originalLang: "en",
    title: "Test headline",
    sourceUrl: "https://example.com/1",
    publishedAt: "Apr 18 • 09:00",
    publishedTimestamp: 1_700_000_000_000,
    summary: "Summary",
    topic: "politics",
    imageUrl: null,
    sourceId: "src-a",
    sourceName: "Source A",
    credibility: 7,
    coverageCount: 1,
    ...overrides,
});

test("scoreStory rewards coverage and breaking status", () => {
    const a = makeItem({ coverageCount: 1, credibility: 7, topic: "politics" });
    const b = makeItem({ coverageCount: 3, credibility: 5, topic: "breaking" });
    assert.ok(scoreStory(b, 1_700_000_000_000) > scoreStory(a, 1_700_000_000_000));
});

test("selectHero prefers a photo-backed lead and returns supporting stories", () => {
    const items = [
        makeItem({ id: "lead", imageUrl: "https://example.com/lead.jpg", title: "Lead story", coverageCount: 4, credibility: 8 }),
        makeItem({ id: "support-1", title: "Support one", coverageCount: 2, credibility: 6 }),
        makeItem({ id: "support-2", title: "Support two", coverageCount: 2, credibility: 6 }),
    ];

    const result = selectHero(items, 2, 1_700_000_000_000);
    if (!result.lead) throw new Error("Expected a lead story");
    assert.equal(result.lead.id, "lead");
    assert.equal(result.side.length, 2);
});

test("diversifyBySource swaps repeated outlets locally", () => {
    const items = [
        makeItem({ id: "a", sourceId: "src-1" }),
        makeItem({ id: "b", sourceId: "src-1" }),
        makeItem({ id: "c", sourceId: "src-2" }),
        makeItem({ id: "d", sourceId: "src-1" }),
    ];

    const result = diversifyBySource(items, 3);
    assert.equal(result[0].id, "a");
    assert.equal(result[1].id, "c");
});

test("selectTicker prefers urgent fresh stories", () => {
    const items = [
        makeItem({ id: "old", publishedTimestamp: 1_700_000_000_000 - 13 * 60 * 60 * 1000 }),
        makeItem({ id: "breaking", topic: "breaking", publishedTimestamp: 1_700_000_000_000 }),
    ];
    const result = selectTicker(items, 5, 1_700_000_000_000);
    assert.equal(result[0].id, "breaking");
});

test("selectTrending respects the per-source cap and exclusions", () => {
    const items = [
        makeItem({ id: "a", sourceId: "src-1", coverageCount: 4 }),
        makeItem({ id: "b", sourceId: "src-1", coverageCount: 3 }),
        makeItem({ id: "c", sourceId: "src-2", coverageCount: 2 }),
    ];
    const result = selectTrending(items, new Set(["a"]), 3, 1_700_000_000_000);
    assert.equal(result.length, 2);
    assert.ok(result.some((item) => item.id === "c"));
});
