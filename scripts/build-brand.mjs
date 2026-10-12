#!/usr/bin/env node
// scripts/build-brand.mjs
//
// Render every brand image in public/ from the two sources in brand/.
//
//   node scripts/build-brand.mjs
//
// The icons are generated rather than drawn once and committed as binaries
// nobody can edit. A favicon set is eleven files that must all say the same
// thing; keeping them derived from one SVG is the only way that stays true
// after the first change to the mark.
//
// Needs rsvg-convert (librsvg) and ImageMagick, both of which render SVG more
// faithfully than sharp's resvg for this kind of flat geometry — and ImageMagick
// is the only one of the three that writes a multi-image .ico.
//
// Every ImageMagick call passes -strip. Without it ImageMagick writes the
// current time into a tEXt chunk, so a rebuild that changed nothing still
// produced different bytes and showed up as a modified file in git — which
// makes "are the committed icons what the script produces?" unanswerable.
//
// The text in the OG image is rasterised here, so it carries no font
// dependency to the viewer. Nothing in public/ contains live <text>: an SVG
// served to a browser renders with whatever font that machine happens to have,
// which for a wordmark means the logo is different on every computer.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const BRAND = join(ROOT, "brand");
const PUBLIC = join(ROOT, "public");
const TMP = join(ROOT, ".brand-tmp");

/** Facebook's palette, the same values app/globals.css sets. */
const BLUE = "#1877f2";
const AMBER = "#f7b928";
const PAGE = "#f0f2f5";
const INK = "#050505";
const INK_SOFT = "#606770";

const run = (cmd, args) => execFileSync(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });

function need(cmd) {
  try {
    run("sh", ["-c", `command -v ${cmd}`]);
  } catch {
    console.error(`${cmd} is required. Install librsvg and ImageMagick.`);
    process.exit(2);
  }
}
need("rsvg-convert");
need("magick");

const svgToPng = (svg, size, out) =>
  run("rsvg-convert", ["-w", String(size), "-h", String(size), svg, "-o", out]);

rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

const full = join(BRAND, "mark.svg");
const small = join(BRAND, "mark-small.svg");
for (const f of [full, small]) {
  if (!existsSync(f)) {
    console.error(`missing source: ${f}`);
    process.exit(2);
  }
}

const made = [];
const emit = (name) => made.push(name);

// ── Favicons ────────────────────────────────────────────────────────────────
//
// From the small mark, not the full one. Below about forty pixels the shoulder
// peak and the two dispatch rules turn to mud, and a muddy icon at 16px is
// worse than a plain one.
svgToPng(small, 16, join(PUBLIC, "favicon-16x16.png"));
svgToPng(small, 32, join(PUBLIC, "favicon-32x32.png"));
emit("favicon-16x16.png");
emit("favicon-32x32.png");

// .ico carries 16, 32 and 48. 48 is what Windows shows on the desktop and in
// the taskbar, and leaving it out makes Windows scale the 32 badly.
for (const s of [16, 32, 48]) svgToPng(small, s, join(TMP, `ico-${s}.png`));
run("magick", [
  join(TMP, "ico-16.png"),
  join(TMP, "ico-32.png"),
  join(TMP, "ico-48.png"),
  join(PUBLIC, "favicon.ico"),
]);
emit("favicon.ico");

// ── Apple touch icon ────────────────────────────────────────────────────────
//
// 180×180 and deliberately opaque. iOS composites the icon onto white and
// applies its own rounded mask, so a transparent corner shows as a white
// corner outside the mask — the tile is drawn full-bleed and square here, and
// iOS rounds it.
run("magick", ["-size", "180x180", `xc:${BLUE}`, join(TMP, "apple-bg.png")]);
svgToPng(full, 180, join(TMP, "apple-fg.png"));
run("magick", [
  join(TMP, "apple-bg.png"),
  join(TMP, "apple-fg.png"),
  "-composite",
  "-alpha",
  "remove",
  "-alpha",
  "off",
  "-strip",
  join(PUBLIC, "apple-touch-icon.png"),
]);
emit("apple-touch-icon.png");

// ── Android / PWA ───────────────────────────────────────────────────────────
svgToPng(full, 192, join(PUBLIC, "android-chrome-192x192.png"));
svgToPng(full, 512, join(PUBLIC, "android-chrome-512x512.png"));
emit("android-chrome-192x192.png");
emit("android-chrome-512x512.png");

// Maskable: Android crops this to whatever shape the launcher uses, and the
// guaranteed-visible area is the middle 80%. The mark is drawn at 60% on a
// full-bleed blue field so a circular crop still has the whole range inside it.
svgToPng(full, 307, join(TMP, "maskable-fg.png")); // 512 * 0.6
run("magick", ["-size", "512x512", `xc:${BLUE}`, join(TMP, "maskable-bg.png")]);
run("magick", [
  join(TMP, "maskable-bg.png"),
  join(TMP, "maskable-fg.png"),
  "-gravity",
  "center",
  "-composite",
  "-alpha",
  "remove",
  "-alpha",
  "off",
  "-strip",
  join(PUBLIC, "maskable-512x512.png"),
]);
emit("maskable-512x512.png");

// ── Open Graph card ─────────────────────────────────────────────────────────
//
// 1200×630, the size Facebook, LinkedIn and X all crop from. Built as an SVG
// and rasterised here so the type is pixels by the time anyone sees it.
//
// The strip along the bottom is the nine category colours in taxonomy order.
// It is the one element that could not belong to any other news site, because
// it is this site's own sections.
const TOPICS = [
  "#d41c3b", // breaking
  "#1569d5", // politics
  "#0074a6", // world
  "#47791c", // sports
  "#c1327e", // society
  "#886616", // business
  "#257b5c", // health
  "#007a7a", // technology
  "#65676b", // environment
];
const stripW = 1200 / TOPICS.length;
const strip = TOPICS.map(
  (c, i) =>
    `<rect x="${(i * stripW).toFixed(2)}" y="620" width="${stripW.toFixed(2)}" height="10" fill="${c}"/>`,
).join("\n  ");

const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${PAGE}"/>
  <rect x="64" y="56" width="1072" height="518" rx="20" fill="#ffffff"/>
  <g transform="translate(120 150) scale(2.5)">
    <rect width="64" height="64" rx="14" fill="${BLUE}"/>
    <g stroke-linejoin="round" stroke-width="2.4">
      <path d="M11 41 L23 25 L30 33 L40 18 L53 41 Z" fill="#ffffff" stroke="#ffffff"/>
      <path d="M40 18 L46.5 29.5 L33.5 29.5 Z" fill="${AMBER}" stroke="${AMBER}"/>
    </g>
    <rect x="11" y="47" width="42" height="3.2" rx="1.6" fill="#ffffff"/>
    <rect x="11" y="53.5" width="27" height="3.2" rx="1.6" fill="#ffffff" fill-opacity="0.55"/>
  </g>
  <text x="330" y="232" font-family="Inter" font-size="86" font-weight="700" fill="${INK}" letter-spacing="-2">EkJhalak</text>
  <text x="334" y="300" font-family="Noto Sans Devanagari" font-size="52" font-weight="500" fill="${INK_SOFT}">एक झलक</text>
  <rect x="330" y="340" width="96" height="4" rx="2" fill="${BLUE}"/>
  <text x="330" y="408" font-family="Inter" font-size="34" font-weight="400" fill="${INK_SOFT}">Calm bilingual briefings for Nepal and the world.</text>
  <text x="330" y="458" font-family="Inter" font-size="34" font-weight="400" fill="${INK_SOFT}">No clutter, no noise.</text>
  <text x="330" y="524" font-family="Inter" font-size="24" font-weight="600" fill="${BLUE}" letter-spacing="3">EKJHALAK.NEWS</text>
  ${strip}
</svg>`;
writeFileSync(join(TMP, "og.svg"), og);
run("rsvg-convert", ["-w", "1200", "-h", "630", join(TMP, "og.svg"), "-o", join(TMP, "og.png")]);
run("magick", [
  join(TMP, "og.png"),
  "-alpha",
  "remove",
  "-alpha",
  "off",
  "-strip",
  join(PUBLIC, "og-image.png"),
]);
emit("og-image.png");

rmSync(TMP, { recursive: true, force: true });

console.log("brand images written to public/:");
for (const m of made) console.log(`  ${m}`);
console.log("  favicon.svg and logo.svg are copied from brand/ by the step below");
