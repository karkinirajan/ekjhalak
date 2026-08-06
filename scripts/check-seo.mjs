#!/usr/bin/env node
// scripts/check-seo.mjs
//
// The Phase 3 gate, as a command rather than a paragraph in a markdown file.
//
//   node scripts/check-seo.mjs [url]
//   pnpm check:seo
//
// Checks the things that are only true of a deployed site: sitemap contents, a
// real 404 for an expired permalink, and a NewsArticle block with every property
// Google's Rich Results Test requires. The interactive Rich Results Test still
// wants a human with a browser; this is the structural half, which is the half
// that regresses silently.
//
// Exit code is the number of failed gates.

const DEFAULT_URL = "https://ekjhalak.news";
const base = (process.argv[2] ?? DEFAULT_URL).replace(/\/$/, "");

const fail = [];
const pass = [];

function gate(name, ok, actual, expected) {
  (ok ? pass : fail).push({ name, actual, expected });
}

async function text(path, init) {
  const res = await fetch(`${base}${path}`, { redirect: "follow", ...init });
  return { status: res.status, body: await res.text() };
}

// ── sitemap.xml ─────────────────────────────────────────────────────────────
const sitemap = await text("/sitemap.xml");
const urlCount = (sitemap.body.match(/<url>/g) ?? []).length;
gate("sitemap.xml lists story URLs", urlCount > 6, `${urlCount} <url>`, "> 6");
// Only the <loc> values. A bare `includes("//www.")` matches the sitemap's own
// XML namespace, `http://www.sitemaps.org/schemas/sitemap/0.9`, which is
// required and correct — the first version of this check failed on that.
const locs = [...sitemap.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const wwwLocs = locs.filter((u) => u.includes("//www."));
gate(
  "sitemap.xml uses the canonical host",
  wwwLocs.length === 0,
  wwwLocs.length ? `${wwwLocs.length} of ${locs.length} point at www` : `${locs.length} on apex`,
  "apex",
);

// ── news-sitemap.xml ────────────────────────────────────────────────────────
const news = await text("/news-sitemap.xml");
const newsCount = (news.body.match(/<news:news>/g) ?? []).length;
gate("news-sitemap.xml served", news.status === 200, `HTTP ${news.status}`, "200");
gate("news-sitemap.xml has entries", newsCount > 0, `${newsCount}`, "> 0");
// Google's documented ceiling. Past it the file is rejected whole, not truncated.
gate("news-sitemap.xml under Google's cap", newsCount <= 1000, `${newsCount}`, "<= 1000");
for (const required of [
  'xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"',
  "<news:publication>",
  "<news:name>",
  "<news:language>",
  "<news:publication_date>",
  "<news:title>",
]) {
  gate(
    `news sitemap has ${required.replace(/[<>]/g, "")}`,
    news.body.includes(required),
    news.body.includes(required) ? "present" : "MISSING",
    "present",
  );
}

// ── robots.txt ──────────────────────────────────────────────────────────────
const robots = await text("/robots.txt");
gate(
  "robots.txt lists both sitemaps",
  robots.body.includes("/sitemap.xml") && robots.body.includes("/news-sitemap.xml"),
  robots.body.match(/Sitemap:.*/g)?.join(" ") ?? "none",
  "both",
);

// ── a story page ────────────────────────────────────────────────────────────
const feed = await fetch(`${base}/api/news?range=day&limit=1`).then((r) => r.json());
const id = feed.items?.[0]?.id;
if (!id) {
  console.error("feed returned no items — cannot check a story page");
  process.exit(1);
}

const story = await text(`/story/${id}`);
gate("a real story page serves 200", story.status === 200, `HTTP ${story.status}`, "200");

const blocks = [...story.body.matchAll(
  /<script type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs,
)].map((m) => {
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
});
gate(
  "every JSON-LD block parses",
  blocks.every(Boolean),
  `${blocks.filter(Boolean).length}/${blocks.length}`,
  "all",
);

const article = blocks.find((b) => b?.["@type"] === "NewsArticle");
gate("NewsArticle schema present", Boolean(article), article ? "yes" : "no", "yes");

if (article) {
  for (const [prop, ok] of [
    ["headline", typeof article.headline === "string" && article.headline.length > 0],
    ["datePublished", typeof article.datePublished === "string"],
    ["dateModified", typeof article.dateModified === "string"],
    ["author", typeof article.author === "object"],
    ["publisher", typeof article.publisher === "object"],
    ["publisher.logo", typeof article.publisher?.logo === "object"],
    ["mainEntityOfPage", typeof article.mainEntityOfPage === "object"],
    ["isBasedOn (the source article)", typeof article.isBasedOn === "string"],
  ]) {
    gate(`NewsArticle.${prop}`, ok, ok ? "present" : "MISSING", "present");
  }
  // Google truncates past 110 and the excerpt cap governs the description.
  gate(
    "NewsArticle.headline within 110 chars",
    (article.headline ?? "").length <= 110,
    `${(article.headline ?? "").length}`,
    "<= 110",
  );
  gate(
    "NewsArticle.description within the display cap",
    (article.description ?? "").length <= 400,
    `${(article.description ?? "").length}`,
    "<= 400",
  );
  // The schema must credit the newsroom, not us. This is the claim that makes
  // publishing it safe — see lib/story-excerpt.ts.
  gate(
    "author is the source, not EkJhalak",
    article.author?.name && !/ekjhalak/i.test(article.author.name),
    article.author?.name ?? "none",
    "the originating newsroom",
  );
}

for (const tag of ["og:title", "og:description", "og:url", "og:type"]) {
  const has = story.body.includes(`property="${tag}"`);
  gate(`story page has ${tag}`, has, has ? "present" : "MISSING", "present");
}
gate(
  "story page has a canonical link",
  /<link rel="canonical"/.test(story.body),
  /<link rel="canonical"/.test(story.body) ? "present" : "MISSING",
  "present",
);
gate(
  "story page renders the outbound link above the fold",
  story.body.includes("Read the full story at"),
  story.body.includes("Read the full story at") ? "present" : "MISSING",
  "present",
);

// ── an expired permalink must be a real 404, not a soft one ─────────────────
const missing = await fetch(`${base}/story/deadbeefcafe`, { redirect: "follow" });
gate(
  "unknown story id returns a real 404",
  missing.status === 404,
  `HTTP ${missing.status}`,
  "404",
);

// ── Report ──────────────────────────────────────────────────────────────────
console.log(`\nSEO GATE · ${base}\n`);
for (const g of pass) console.log(`  PASS  ${g.name.padEnd(46)} ${g.actual}`);
for (const g of fail)
  console.log(`  FAIL  ${g.name.padEnd(46)} ${g.actual}  (need ${g.expected})`);
console.log(
  `\n${fail.length === 0 ? "All SEO gates pass." : `${fail.length} gate(s) failed.`}\n`,
);

process.exit(fail.length);
