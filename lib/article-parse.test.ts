import assert from "node:assert/strict";
import test from "node:test";

import {
  bestCandidate,
  jsonLdBody,
  looksLikeNavigation,
  paragraphText,
  parseArticle,
  parseMetaTags,
  pageImage,
  restoreSentenceSpacing,
} from "./article-parse";

const page = (head: string, body = "") =>
  `<html><head>${head}</head><body>${body}</body></html>`;

// ── Metadata ────────────────────────────────────────────────────────────────

test("both attribute orders and both quote styles are read", () => {
  // The two regexes this replaced existed because publishers emit these tags in
  // whichever order their template happened to produce.
  const meta = parseMetaTags(
    page(
      `<meta property="og:description" content="first">` +
        `<meta content='second' name='description'>`,
    ),
  );
  assert.equal(meta.get("property:og:description"), "first");
  assert.equal(meta.get("name:description"), "second");
});

test("the first declaration of a key wins", () => {
  // Matching the old `.match()` semantics exactly: it stopped at the first hit.
  const meta = parseMetaTags(
    page(
      `<meta property="og:image" content="https://a.example/1.jpg">` +
        `<meta property="og:image" content="https://a.example/2.jpg">`,
    ),
  );
  assert.equal(pageImage(meta, "https://x.example/a"), "https://a.example/1.jpg");
});

test("og tags outside the head are still found", () => {
  // The reason this scans the whole document rather than slicing at </head>.
  const meta = parseMetaTags(
    page("", `<p>x</p><meta property="og:description" content="late but real">`),
  );
  assert.equal(meta.get("property:og:description"), "late but real");
});

test("escaped markup in a meta value is decoded then stripped", () => {
  // DC Nepal shipped og:description as escaped article HTML, so decoding alone
  // printed a literal <p> to the reader.
  const meta = parseMetaTags(
    page(`<meta property="og:description" content="&lt;p&gt;काठमाडौं। खबर छ।&lt;/p&gt;">`),
  );
  const got = bestCandidate(page(""), meta);
  assert.ok(!got || !/[<>]/.test(got.text), "markup survived into reader text");
});

// ── Candidate ordering ──────────────────────────────────────────────────────

test("structured metadata beats a longer paragraph scrape", () => {
  // Paragraph scraping was beating a good 2,063-char og:description with 3,658
  // characters of site menu. Trustworthiness, not length.
  const desc = "काठमाडौं। " + "नेपालमा आज एउटा महत्त्वपूर्ण घटना भयो। ".repeat(8);
  const html = page(
    `<meta property="og:description" content="${desc}">`,
    "<p>" + "Home Politics Sports World Business Opinion Culture ".repeat(40) + "</p>",
  );
  const got = bestCandidate(html, parseMetaTags(html));
  assert.equal(got?.via, "og");
});

test("a site menu rendered in <p> is rejected as navigation", () => {
  assert.equal(
    looksLikeNavigation("गृहपृष्ठ राजनीति विश्वकप फुटबल प्रदेश समाचार " .repeat(10)),
    true,
  );
  assert.equal(
    looksLikeNavigation("The bank raised rates today. Analysts expect more."),
    false,
  );
});

test("paragraphs are the last resort, and still work", () => {
  const prose =
    "The central bank raised its policy rate today, citing persistent inflation. " +
    "Analysts had expected the move but not its size. ";
  const html = page("", `<p>${prose.repeat(2)}</p>`);
  const got = bestCandidate(html, parseMetaTags(html));
  assert.equal(got?.via, "paragraphs");
  assert.ok(got.text.length >= 120);
});

// ── The bound ───────────────────────────────────────────────────────────────

test("an already-expired deadline skips the expensive stages", () => {
  // The D3 fix. Cheap metadata still answers; nothing that scales with page size
  // is allowed to start.
  const html = page(
    "",
    `<p>${"The bank raised its policy rate today, and said more may follow. ".repeat(20)}</p>`,
  );
  const expired = Date.now() - 1;

  assert.equal(bestCandidate(html, parseMetaTags(html))?.via, "paragraphs");
  assert.equal(bestCandidate(html, parseMetaTags(html), expired), null);
});

test("a deadline does not suppress metadata that costs nothing to read", () => {
  // Out of time must degrade, not blank out. og: is a map lookup by then.
  const desc = "काठमाडौं। " + "यो समाचार पर्याप्त लामो छ। ".repeat(12);
  const html = page(`<meta property="og:description" content="${desc}">`);
  const got = bestCandidate(html, parseMetaTags(html), Date.now() - 1);
  assert.equal(got?.via, "og");
});

test("paragraph scanning is bounded by input size, not by luck", () => {
  // 1.2 MB of filler with the prose at the very end. Before the bound this
  // scanned every byte; now it stops, and the story keeps the publisher's text.
  const filler = "<div>related</div><p>tiny</p>".repeat(20_000);
  const prose = `<p>${"A real sentence about a real event happened today. ".repeat(6)}</p>`;
  const html = page("", filler + prose);
  assert.ok(html.length > 500_000, "fixture is not large enough to test the bound");

  const started = Date.now();
  const got = bestCandidate(html, parseMetaTags(html));
  const elapsed = Date.now() - started;

  assert.ok(elapsed < 250, `parse took ${elapsed}ms — the bound is not holding`);
  assert.equal(got, null, "prose past the scan window must not be reached");
});

test("a JSON-LD data dump is skipped rather than parsed", () => {
  // A megabyte of JSON is a product catalogue, and JSON.parse on it is unbounded
  // synchronous work in the middle of a request-path budget.
  const dump = JSON.stringify({ items: Array.from({ length: 20_000 }, (_, i) => ({ i })) });
  assert.ok(dump.length > 200_000);
  const html = page(
    `<script type="application/ld+json">${dump}</script>` +
      `<script type="application/ld+json">${JSON.stringify({
        "@type": "NewsArticle",
        articleBody: "काठमाडौं। " + "यो वास्तविक समाचार हो। ".repeat(12),
      })}</script>`,
  );
  const started = Date.now();
  const body = jsonLdBody(html);
  assert.ok(Date.now() - started < 250);
  assert.ok(body.includes("वास्तविक"), "the real Article node was not reached");
});

test("@graph-nested Article nodes are still found", () => {
  const html = page(
    `<script type="application/ld+json">${JSON.stringify({
      "@graph": [{ "@type": "WebSite" }, { "@type": "NewsArticle", articleBody: "Body text here." }],
    })}</script>`,
  );
  assert.equal(jsonLdBody(html), "Body text here.");
});

// ── Assembly ────────────────────────────────────────────────────────────────

test("a page with an image but no text still returns the image", () => {
  // The card still has a frame to fill even when there is nothing to summarise.
  const html = page(`<meta property="og:image" content="https://a.example/p.jpg">`);
  const got = parseArticle(html, "https://x.example/a");
  assert.equal(got?.imageUrl, "https://a.example/p.jpg");
  assert.equal(got?.text, "");
});

test("a page with neither returns null", () => {
  assert.equal(parseArticle(page(""), "https://x.example/a"), null);
});

test("relative and non-https images are resolved or dropped", () => {
  const rel = parseMetaTags(page(`<meta property="og:image" content="/img/a.jpg">`));
  assert.equal(pageImage(rel, "https://x.example/story/1"), "https://x.example/img/a.jpg");

  const insecure = parseMetaTags(page(`<meta property="og:image" content="http://x.example/a.jpg">`));
  assert.equal(pageImage(insecure, "https://x.example/a"), null);
});

test("dandas get their space back, full stops do not", () => {
  assert.equal(restoreSentenceSpacing("गरेको छ।अर्थमन्त्री"), "गरेको छ। अर्थमन्त्री");
  // Doing the same for "." would break "U.S." and every decimal in the English feeds.
  assert.equal(restoreSentenceSpacing("the U.S. rate"), "the U.S. rate");
});

test("paragraph accumulation stops at the character cap", () => {
  const one = `<p>${"A perfectly ordinary sentence about the news. ".repeat(4)}</p>`;
  const text = paragraphText(page("", one.repeat(200)));
  assert.ok(text.length <= 6_400, `got ${text.length} chars past the cap`);
});
