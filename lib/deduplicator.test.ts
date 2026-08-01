import assert from "node:assert/strict";
import test from "node:test";

import { deduplicate, jaccardSimilarity } from "./deduplicator";
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

test("jaccardSimilarity handles shared words and ignores punctuation", () => {
    assert.equal(jaccardSimilarity("A major earthquake hits Nepal", "A major earthquake hits Kathmandu"), 0.6);
    assert.equal(jaccardSimilarity("Hello world", "Something else"), 0);
});

test("deduplicate merges near-duplicates and records coverage counts", () => {
    const items = [
        makeItem({ id: "a", title: "Nepal votes in historic election", sourceId: "src-a", publishedTimestamp: 1_700_000_000_000 }),
        makeItem({ id: "b", title: "Historic election in Nepal", sourceId: "src-b", publishedTimestamp: 1_700_000_000_100 }),
        makeItem({ id: "c", title: "Completely different story", sourceId: "src-c", publishedTimestamp: 1_700_000_000_200 }),
    ];

    const result = deduplicate(items);

    assert.equal(result.length, 2);
    assert.equal(result[0].coverageCount, 2);
    assert.equal(result[1].id, "c");
});
