import assert from "node:assert/strict";
import test from "node:test";

import {
  countStories,
  digestDate,
  pickStories,
  renderDigest,
  unsubscribeHeaders,
  type RenderOptions,
} from "./digest";
import type { NewsItem } from "./news-pipeline";

function story(overrides: Partial<NewsItem> & { id: string }): NewsItem {
  return {
    bucket: "national",
    originalLang: "en",
    title: `Headline ${overrides.id}`,
    sourceUrl: `https://publisher.example/${overrides.id}`,
    publishedAt: "Oct 30 • 09:00",
    publishedTimestamp: 1_000,
    summary: `Summary ${overrides.id}`,
    topic: "society",
    imageUrl: null,
    sourceId: "pub",
    sourceName: "Publisher",
    credibility: 7,
    coverageCount: 1,
    ...overrides,
  } as NewsItem;
}

const options = (over: Partial<RenderOptions> = {}): RenderOptions => ({
  lang: "en",
  now: new Date("2026-10-30T20:00:00Z"),
  unsubscribeUrl: "https://ekjhalak.news/unsubscribe?token=abc",
  storyUrl: (id) => `https://ekjhalak.news/story/${id}`,
  siteUrl: "https://ekjhalak.news",
  ...over,
});

test("stories are ranked by outlet coverage, then recency", () => {
  const picked = pickStories(
    [
      story({ id: "a", coverageCount: 1, publishedTimestamp: 9_000 }),
      story({ id: "b", coverageCount: 3, publishedTimestamp: 1_000 }),
      story({ id: "c", coverageCount: 1, publishedTimestamp: 5_000 }),
    ],
    10,
  );
  assert.deepEqual(
    picked.national.map((s) => s.id),
    ["b", "a", "c"],
  );
});

test("the cut is made on the overall ranking, then split into sections", () => {
  const picked = pickStories(
    [
      story({ id: "n1", bucket: "national", coverageCount: 2 }),
      story({ id: "w1", bucket: "international", coverageCount: 5 }),
      story({ id: "n2", bucket: "national", coverageCount: 1 }),
      story({ id: "w2", bucket: "international", coverageCount: 4 }),
    ],
    3,
  );
  assert.deepEqual(picked.international.map((s) => s.id), ["w1", "w2"]);
  assert.deepEqual(picked.national.map((s) => s.id), ["n1"]);
  assert.equal(countStories(picked), 3);
});

test("ties break on id so the same input yields the same email", () => {
  const items = [story({ id: "b" }), story({ id: "a" }), story({ id: "c" })];
  const first = pickStories(items, 10).national.map((s) => s.id);
  const second = pickStories([...items].reverse(), 10).national.map((s) => s.id);
  assert.deepEqual(first, ["a", "b", "c"]);
  assert.deepEqual(second, first);
});

test("a cap of zero or less picks nothing", () => {
  assert.equal(countStories(pickStories([story({ id: "a" })], 0)), 0);
  assert.equal(countStories(pickStories([story({ id: "a" })], -3)), 0);
});

test("the digest date follows Nepal time, not UTC", () => {
  // 18:00 UTC is 23:45 in Kathmandu — still the 30th.
  assert.equal(digestDate(new Date("2026-10-30T18:00:00Z")), "2026-10-30");
  // 19:00 UTC is 00:45 on the 31st there, though UTC says the 30th.
  assert.equal(digestDate(new Date("2026-10-30T19:00:00Z")), "2026-10-31");
});

test("every run in one morning's send window shares a digest date", () => {
  // 01:15, 01:30 and 01:45 UTC are 07:00, 07:15 and 07:30 in Kathmandu.
  const dates = ["01:15", "01:30", "01:45"].map((t) =>
    digestDate(new Date(`2026-10-30T${t}:00Z`)),
  );
  assert.deepEqual(new Set(dates).size, 1);
});

test("markup in a headline or source name cannot break out of the email", () => {
  const picked = pickStories(
    [
      story({
        id: "x",
        title: `<script>alert(1)</script> "quoted" & more`,
        summary: `<img src=x onerror=alert(1)>`,
        sourceName: `<b>Evil</b>`,
      }),
    ],
    5,
  );
  const { html } = renderDigest(picked, options());
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("<img src=x"));
  assert.ok(!html.includes("<b>Evil</b>"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("&quot;quoted&quot; &amp; more"));
});

test("every email carries the reader's unsubscribe link, in both parts", () => {
  const picked = pickStories([story({ id: "a" })], 5);
  const { html, text } = renderDigest(picked, options());
  assert.ok(html.includes("https://ekjhalak.news/unsubscribe?token=abc"));
  assert.ok(text.includes("https://ekjhalak.news/unsubscribe?token=abc"));
});

test("a Nepali reader gets the Nepali headline of an English story", () => {
  const picked = pickStories(
    [
      story({
        id: "a",
        title: "English headline",
        titleTranslated: "नेपाली शीर्षक",
        summary: "English summary",
        summaryTranslated: "नेपाली सारांश",
      }),
    ],
    5,
  );
  const np = renderDigest(picked, options({ lang: "np" }));
  assert.ok(np.html.includes("नेपाली शीर्षक"));
  assert.ok(!np.html.includes("English headline"));

  const en = renderDigest(picked, options({ lang: "en" }));
  assert.ok(en.html.includes("English headline"));
});

test("a missing translation falls back to the original rather than dropping the story", () => {
  const picked = pickStories([story({ id: "a", title: "Only English" })], 5);
  const np = renderDigest(picked, options({ lang: "np" }));
  assert.ok(np.html.includes("Only English"));
});

test("an empty section is left out entirely", () => {
  const picked = pickStories([story({ id: "w", bucket: "international" })], 5);
  const { html, text } = renderDigest(picked, options());
  assert.ok(html.includes(">World<"));
  assert.ok(!html.includes(">Nepal<"));
  assert.ok(!text.includes("NEPAL"));
});

test("stories link to the site's own story page", () => {
  const picked = pickStories([story({ id: "abc123" })], 5);
  const { html, text } = renderDigest(picked, options());
  assert.ok(html.includes('href="https://ekjhalak.news/story/abc123"'));
  assert.ok(text.includes("https://ekjhalak.news/story/abc123"));
});

test("the subject names the day in the reader's language", () => {
  const picked = pickStories([story({ id: "a" })], 5);
  assert.match(renderDigest(picked, options()).subject, /^EkJhalak daily brief — /);
  assert.match(renderDigest(picked, options({ lang: "np" })).subject, /^एक झलक दैनिक ब्रिफिङ — /);
});

test("the email declares its charset, viewport, colour scheme and title", () => {
  const picked = pickStories([story({ id: "a" })], 5);
  const { html, subject } = renderDigest(picked, options({ lang: "np" }));
  assert.ok(html.includes('<meta charset="utf-8">'));
  assert.ok(html.includes('name="viewport" content="width=device-width, initial-scale=1"'));
  assert.ok(html.includes('name="color-scheme" content="light"'));
  assert.ok(html.includes(`<title>${subject}</title>`));
  assert.ok(html.includes('<html lang="ne">'));
});

test("the one-click unsubscribe headers follow RFC 8058", () => {
  assert.deepEqual(unsubscribeHeaders("https://ekjhalak.news/api/unsubscribe?token=t"), {
    "List-Unsubscribe": "<https://ekjhalak.news/api/unsubscribe?token=t>",
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  });
});
