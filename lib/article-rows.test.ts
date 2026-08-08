import assert from "node:assert/strict";
import test from "node:test";

import {
  fromRow,
  partitionForWrite,
  toCoreRow,
  toEnrichedRow,
  type StoredArticleRow,
} from "./article-rows";
import type { NewsItem } from "./news-pipeline";

const SEEN_AT = "2026-08-08T09:00:00.000Z";

const base = (over: Partial<NewsItem> = {}): NewsItem => ({
  id: "abc123def456",
  bucket: "national",
  originalLang: "en",
  title: "Nepal Rastra Bank raises the policy rate",
  sourceUrl: "https://example.com/1",
  publishedAt: "Aug 6, 2026 • 09:00",
  publishedTimestamp: Date.parse("2026-08-06T09:00:00.000Z"),
  summary: "A summary long enough to be a real one, with a full stop.",
  topic: "business",
  imageUrl: null,
  sourceId: "src",
  sourceName: "Source",
  credibility: 7,
  coverageCount: 1,
  ...over,
});

const ENRICHMENT_COLUMNS = [
  "title_translated",
  "summary_translated",
  "enrichment_key",
  "quality",
] as const;

test("first_seen_at is never sent, in either payload shape", () => {
  // The one column in this table that cannot be recovered from anywhere else:
  // the feeds do not remember when we first saw a story. merge-duplicates would
  // reset it to now() on every pass if it ever appeared in a payload.
  const { enriched, core } = partitionForWrite(
    [base({ enrichmentKey: "abc123def456:xyz" }), base({ id: "0000aaaa1111" })],
    SEEN_AT,
  );
  for (const row of [...enriched, ...core]) {
    assert.ok(!("first_seen_at" in row), "first_seen_at leaked into a payload");
  }
});

test("a story this pass did not enrich omits the enrichment columns entirely", () => {
  // The invariant this whole partition exists for. Sending `title_translated:
  // null` for a story the pass never reached would erase a translation an
  // earlier pass paid a metered model request for — 288 times a day.
  const { core, enriched } = partitionForWrite([base()], SEEN_AT);
  assert.equal(enriched.length, 0);
  assert.equal(core.length, 1);

  for (const column of ENRICHMENT_COLUMNS) {
    assert.ok(
      !(column in core[0]),
      `${column} must be absent, not null — present keys are overwritten`,
    );
  }
});

test("null is not the same as absent", () => {
  // The failure mode in one assertion: a story that *was* enriched but whose
  // translation the audit rejected sends an explicit null, which is correct and
  // deliberate — it withdraws a translation for text that has since changed.
  // A story that was never looked at sends nothing at all. The two must not be
  // collapsed into one row shape.
  const rejected = toEnrichedRow(
    base({ enrichmentKey: "abc123def456:xyz" }),
    SEEN_AT,
  );
  const untouched = toCoreRow(base(), SEEN_AT);

  assert.equal(rejected.title_translated, null);
  assert.ok("title_translated" in rejected);
  assert.ok(!("title_translated" in untouched));
});

test("an enriched story carries every enrichment column", () => {
  const { enriched } = partitionForWrite(
    [
      base({
        enrichmentKey: "abc123def456:1a2b3c",
        titleTranslated: "नेपाल राष्ट्र बैंकले नीतिगत दर बढायो",
        summaryTranslated: "पर्याप्त लामो नेपाली सारांश यहाँ छ।",
        quality: { audited: true, bilingual: true, verified: true },
      }),
    ],
    SEEN_AT,
  );

  assert.equal(enriched.length, 1);
  for (const column of ENRICHMENT_COLUMNS) {
    assert.ok(column in enriched[0], `${column} missing`);
  }
  assert.equal(enriched[0].enrichment_key, "abc123def456:1a2b3c");
  assert.equal(enriched[0].quality?.verified, true);
});

test("the partition routes by enrichmentKey and nothing else", () => {
  const items = [
    base({ id: "aaaaaaaaaaaa", enrichmentKey: "k1" }),
    base({ id: "bbbbbbbbbbbb" }),
    // A translation with no key cannot have come from this pass, so it does not
    // earn the right to overwrite. Trust the permission slip, not the payload.
    base({ id: "cccccccccccc", titleTranslated: "क" }),
    base({ id: "dddddddddddd", enrichmentKey: "k2" }),
  ];
  const { enriched, core } = partitionForWrite(items, SEEN_AT);

  assert.deepEqual(
    enriched.map((r) => r.id),
    ["aaaaaaaaaaaa", "dddddddddddd"],
  );
  assert.deepEqual(
    core.map((r) => r.id),
    ["bbbbbbbbbbbb", "cccccccccccc"],
  );
});

// ── Reading back ────────────────────────────────────────────────────────────

const storedRow = (over: Partial<StoredArticleRow> = {}): StoredArticleRow => ({
  id: "abc123def456",
  source_url: "https://example.com/1",
  source_id: "src",
  source_name: "Source",
  title: "A headline",
  summary: "A body.",
  original_lang: "en",
  title_translated: null,
  summary_translated: null,
  bucket: "national",
  topic: "business",
  category: null,
  credibility: 7,
  image_url: null,
  published_at: "2026-08-06T09:00:00.000Z",
  first_seen_at: "2026-08-06T09:05:00.000Z",
  last_seen_at: "2026-08-06T10:00:00.000Z",
  coverage_count: 3,
  alternate_source_ids: ["other"],
  enrichment_key: "abc123def456:xyz",
  quality: { audited: true, bilingual: false },
  ...over,
});

test("a stored row comes back as the item that produced it", () => {
  const item = base({
    enrichmentKey: "abc123def456:1a2b3c",
    titleTranslated: "शीर्षक",
    summaryTranslated: "सारांश।",
    quality: { audited: true, bilingual: true },
    alternateSourceIds: ["other"],
    coverageCount: 3,
  });
  const row = toEnrichedRow(item, SEEN_AT);
  const back = fromRow({ ...row, first_seen_at: SEEN_AT });

  for (const field of [
    "id",
    "title",
    "summary",
    "sourceUrl",
    "sourceId",
    "sourceName",
    "bucket",
    "topic",
    "originalLang",
    "credibility",
    "coverageCount",
    "titleTranslated",
    "summaryTranslated",
    "publishedTimestamp",
  ] as const) {
    assert.deepEqual(back[field], item[field], field);
  }
  assert.deepEqual(back.quality, item.quality);
});

test("a retired topic renders rather than throws", () => {
  // Rows outlive taxonomies. A story page showing the wrong accent colour is a
  // far better outcome than one that 500s because `topic` holds a string the
  // code has since stopped recognising.
  const back = fromRow(storedRow({ topic: "cryptocurrency-corner" }));
  assert.equal(back.topic, "society");
});

test("an unparseable published_at falls back to first_seen_at", () => {
  // first_seen_at is ours and is always well-formed; published_at is the
  // newsroom's claim and occasionally is not.
  const back = fromRow(
    storedRow({ published_at: "not a date", first_seen_at: SEEN_AT }),
  );
  assert.equal(back.publishedTimestamp, Date.parse(SEEN_AT));
});

test("nulls become absent fields, not empty strings", () => {
  // The UI branches on `titleTranslated` being undefined to decide whether a
  // story is bilingual. An empty string is truthy-adjacent enough to have caused
  // a half-translated card before.
  const back = fromRow(storedRow());
  assert.equal(back.titleTranslated, undefined);
  assert.equal(back.summaryTranslated, undefined);
  assert.equal(back.category, undefined);
  assert.equal(back.alternateSourceIds?.length, 1);

  const bare = fromRow(storedRow({ alternate_source_ids: [], quality: null }));
  assert.equal(bare.alternateSourceIds, undefined);
  assert.equal(bare.quality, undefined);
});
