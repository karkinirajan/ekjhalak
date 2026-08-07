import assert from "node:assert/strict";
import test from "node:test";

import {
  applyPublishGate,
  isPublishable,
  previewPolicies,
  type PublishPolicy,
} from "./publish-gate";
import type { NewsItem } from "./news-pipeline";

const base = (over: Partial<NewsItem> = {}): NewsItem => ({
    id: "a",
    bucket: "national",
    originalLang: "en",
    title: "Nepal Rastra Bank raises the policy rate",
    sourceUrl: "https://example.com/1",
    publishedAt: "Aug 6 • 09:00",
    publishedTimestamp: 1_700_000_000_000,
    summary: "A summary long enough to be a real one, with a full stop at the end.",
    topic: "business",
    imageUrl: null,
    sourceId: "src",
    sourceName: "Source",
    credibility: 7,
    coverageCount: 1,
    ...over,
});

/** A story at each level of assurance the pipeline can produce. */
const raw = base({ quality: undefined });
const audited = base({ quality: { audited: true, bilingual: false } });
const bilingual = base({
    titleTranslated: "नेपाल राष्ट्र बैंकले नीतिगत दर बढायो",
    summaryTranslated: "पर्याप्त लामो नेपाली सारांश यहाँ छ।",
    quality: { audited: true, bilingual: true },
});
const verified = base({
    titleTranslated: "नेपाल राष्ट्र बैंकले नीतिगत दर बढायो",
    summaryTranslated: "पर्याप्त लामो नेपाली सारांश यहाँ छ।",
    quality: { audited: true, bilingual: true, verified: true },
});
const failedVerify = base({
    titleTranslated: "नेपाल राष्ट्र बैंकले नीतिगत दर बढायो",
    summaryTranslated: "पर्याप्त लामो नेपाली सारांश यहाँ छ।",
    quality: { audited: true, bilingual: true, verified: false },
});

test("each level admits exactly its own tier and everything stricter", () => {
    const expected: Record<PublishPolicy, NewsItem[]> = {
        all: [raw, audited, bilingual, verified, failedVerify],
        audited: [audited, bilingual, verified, failedVerify],
        bilingual: [bilingual, verified, failedVerify],
        verified: [verified],
    };
    for (const [policy, admitted] of Object.entries(expected)) {
        for (const item of [raw, audited, bilingual, verified, failedVerify]) {
            const should = admitted.includes(item);
            assert.equal(
                isPublishable(item, policy as PublishPolicy),
                should,
                `${policy} / quality=${JSON.stringify(item.quality)}`,
            );
        }
    }
});

test("raising the policy can only ever remove stories", () => {
    const items = [raw, audited, bilingual, verified, failedVerify];
    const counts = previewPolicies(items);
    assert.ok(counts.all >= counts.audited);
    assert.ok(counts.audited >= counts.bilingual);
    assert.ok(counts.bilingual >= counts.verified);
});

test("a story with no body text never publishes, at any policy", () => {
    const empty = base({ summary: "", quality: { audited: true, bilingual: true, verified: true } });
    for (const p of ["all", "audited", "bilingual", "verified"] as PublishPolicy[]) {
        assert.equal(isPublishable(empty, p), false, p);
    }
});

test("unchecked is not the same as failed under `verified`", () => {
    // The distinction the whole gate turns on. Both are withheld under
    // `verified`, but one is waiting for the next pass and the other is a
    // story a model rejected — and they must not be counted together.
    const unchecked = bilingual; // quality.verified === undefined
    assert.equal(isPublishable(unchecked, "verified"), false);
    assert.equal(isPublishable(failedVerify, "verified"), false);

    const gate = applyPublishGate([unchecked, failedVerify], "verified");
    assert.equal(gate.reasons["not yet verified"], 1);
    assert.equal(gate.reasons["failed verification"], 1);
});

test("a claimed translation that is not actually there does not count as bilingual", () => {
    // quality says bilingual, the fields say otherwise. Trust the fields — the
    // flag is a summary of them, not a substitute.
    const lying = base({ quality: { audited: true, bilingual: true } });
    assert.equal(isPublishable(lying, "bilingual"), false);
});

test("the gate reports what it withheld and why", () => {
    const gate = applyPublishGate([raw, audited, bilingual, verified], "verified");
    assert.equal(gate.published.length, 1);
    assert.equal(gate.withheld, 3);
    assert.equal(gate.policy, "verified");
    assert.equal(
        Object.values(gate.reasons).reduce((a, b) => a + b, 0),
        3,
        "every withheld story is accounted for by exactly one reason",
    );
});

test("the default policy keeps a normally-enriched feed intact", () => {
    // The safety property. `audited` must not empty the site on a day when the
    // model quota is exhausted and nothing got translated.
    const quotaExhaustedFeed = Array.from({ length: 50 }, (_, i) =>
        base({ id: `x${i}`, quality: { audited: true, bilingual: false } }),
    );
    const gate = applyPublishGate(quotaExhaustedFeed, "audited");
    assert.equal(gate.published.length, 50);
    assert.equal(gate.withheld, 0);
});
