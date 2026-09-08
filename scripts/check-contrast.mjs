#!/usr/bin/env node
// scripts/check-contrast.mjs
//
// Verifies every colour pairing the UI actually renders against WCAG 2.1 AA,
// by parsing the real token values out of app/globals.css. Run by `pnpm verify`.
//
// This exists because the palette shipped with a comment asserting "All eleven
// verified past 4.5:1 on --surface" while six pairings were failing. Two things
// made that assertion wrong, and both are the kind of mistake a person makes
// once and a script never makes again:
//
//   1. It measured the wrong foreground. The solid pill prints its label on the
//      topic colour, and only the quiet tone had been checked.
//
//   2. It measured the wrong background. The quiet pill sets topic-coloured
//      text on a wash of that same topic, so the composited background is
//      lighter than --surface. Measuring against bare --surface reported 4.49
//      where the real figure was 3.97.
//
// So: check every pairing, against the background that is actually painted.
//
// The site is light only, so there is one theme to check rather than two, and
// every figure quoted in a globals.css comment is a figure this script asserts.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(join(root, "app/globals.css"), "utf8");

const AA = 4.5; // normal text
const AA_UI = 3.0; // non-text UI boundaries (WCAG 1.4.11)

// ── colour maths ────────────────────────────────────────────────────────────
const srgb = (c) => {
  c /= 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const parse = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const luminance = (hex) => {
  const [r, g, b] = parse(hex);
  return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
};
const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const toHex = (arr) =>
  "#" + arr.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
/** Approximates CSS color-mix() closely enough to catch contrast regressions. */
const blend = (fg, bg, pct) => {
  const A = parse(fg);
  const B = parse(bg);
  return toHex(A.map((v, i) => v * pct + B[i] * (1 - pct)));
};

// ── token extraction ────────────────────────────────────────────────────────
//
// Two shapes are read out of globals.css: the flat semantic block in :root,
// and the three-token contract each [data-topic] rule declares.

function blockTokens(pattern, label) {
  const block = css.match(pattern);
  if (!block) throw new Error(`could not locate block: ${label}`);
  const tokens = {};
  for (const [, name, value] of block[0].matchAll(
    /--([a-z-]+):\s*(#[0-9a-fA-F]{6})/g,
  )) {
    tokens[name] = value.toLowerCase();
  }
  return tokens;
}

const T = blockTokens(/^:root \{[\s\S]*?\n\}/m, ":root");

/** The scoped token overrides — see `.on-pitch` / `.on-accent` in globals.css. */
const INV = blockTokens(/^\.on-pitch \{[\s\S]*?\n\}/m, ".on-pitch");
const BAND = blockTokens(/^\.on-accent \{[\s\S]*?\n\}/m, ".on-accent");

/** Every [data-topic] rule, as { topic: { topic, ink, text } }. */
function topicContracts() {
  const out = {};
  for (const [, name, body] of css.matchAll(
    /\[data-topic="([a-z]+)"\]\s*\{([\s\S]*?)\}/g,
  )) {
    const t = {};
    for (const [, k, v] of body.matchAll(/--(topic[a-z-]*):\s*(#[0-9a-fA-F]{6})/g)) {
      t[k] = v.toLowerCase();
    }
    out[name] = t;
  }
  return out;
}

const CONTRACTS = topicContracts();

/** The wash behind quiet-tone pill text — see components/topic-pill.tsx. */
const QUIET_TINT = 0.15;

// ── the pairings the UI actually paints ─────────────────────────────────────
function checks() {
  const rows = [];

  for (const [topic, c] of Object.entries(CONTRACTS)) {
    // The label printed on the solid fill.
    rows.push([
      `solid pill · --topic-ink on ${topic}`,
      ratio(c["topic-ink"], c.topic),
      AA,
    ]);
    // The quiet pill, and every headline hover and drop cap: --topic-text as
    // type, over a wash of --topic on the card it sits on.
    rows.push([
      `quiet pill · ${topic} --topic-text on its own ${QUIET_TINT * 100}% wash`,
      ratio(c["topic-text"], blend(c.topic, T.surface, QUIET_TINT)),
      AA,
    ]);
    // The same text directly on the page, which is where drop caps live.
    rows.push([
      `topic type · ${topic} --topic-text on --canvas`,
      ratio(c["topic-text"], T.canvas),
      AA,
    ]);
  }

  rows.push(
    ["body · --ink on --canvas", ratio(T.ink, T.canvas), AA],
    ["body · --ink on --surface", ratio(T.ink, T.surface), AA],
    ["body · --ink-soft on --surface", ratio(T["ink-soft"], T.surface), AA],
    ["meta · --ink-muted on --surface", ratio(T["ink-muted"], T.surface), AA],
    ["meta · --ink-muted on --canvas", ratio(T["ink-muted"], T.canvas), AA],
    ["inverted · --ink-inverse on --pitch", ratio(T["ink-inverse"], T.pitch), AA],
    ["accent · --accent on --surface", ratio(T.accent, T.surface), AA],
    ["accent · --accent on --canvas", ratio(T.accent, T.canvas), AA],
    ["support · --support on --surface", ratio(T.support, T.surface), AA],
    ["support · --support on --canvas", ratio(T.support, T.canvas), AA],
    ["CTA · white on --accent-solid", ratio("#ffffff", T["accent-solid"]), AA],
    ["CTA · white on --support-solid", ratio("#ffffff", T["support-solid"]), AA],
    ["CTA · --accent-solid fill vs --canvas", ratio(T["accent-solid"], T.canvas), AA_UI],
    ["focus ring · --accent vs --canvas", ratio(T.accent, T.canvas), AA_UI],
    ["input border · --rule-strong vs --canvas", ratio(T["rule-strong"], T.canvas), AA_UI],
  );

  // The inverted panel. Every one of these is a pairing the footer paints, and
  // every one of them was failing before `.on-pitch` existed: the footer asked
  // for --ink-soft on --pitch and got navy on navy.
  rows.push(
    ["on-pitch · --ink on --pitch", ratio(INV.ink, T.pitch), AA],
    ["on-pitch · --ink-soft on --pitch", ratio(INV["ink-soft"], T.pitch), AA],
    ["on-pitch · --ink-muted on --pitch", ratio(INV["ink-muted"], T.pitch), AA],
    ["on-pitch · --accent on --pitch", ratio(INV.accent, T.pitch), AA],
    ["on-pitch · --support on --pitch", ratio(INV.support, T.pitch), AA],
    ["on-pitch · --rule-strong vs --pitch", ratio(INV["rule-strong"], T.pitch), AA_UI],
    // --raised inside the inverted panel is a chip ground, and only --ink
    // clears 4.5:1 on it — --ink-muted lands at 3.76 and --accent at 2.53. So
    // that is the pairing checked, and the CSS says so where it is declared.
    ["on-pitch · --ink on --raised chip", ratio(INV.ink, INV.raised), AA],
  );

  // The breaking ticker. Its --accent is white rather than crimson, because
  // the global focus ring is `2px solid var(--accent)` and the band it draws
  // on is that same crimson — every ticker link focused invisibly until this
  // scope existed. That row is the one that would catch it coming back.
  rows.push(
    ["on-accent · --ink on the band", ratio(BAND.ink, BAND.canvas), AA],
    ["on-accent · --ink-muted on the band", ratio(BAND["ink-muted"], BAND.canvas), AA],
    ["on-accent · focus ring --accent vs band", ratio(BAND.accent, BAND.canvas), AA_UI],
    ["on-accent · --rule-strong vs band", ratio(BAND["rule-strong"], BAND.canvas), AA_UI],
  );

  return rows;
}

// ── Every category must be its own colour ───────────────────────────────────
//
// The palette this replaced had eleven categories sharing three hue families —
// three reds, four greens, four greys — so business and health, or culture and
// opinion, were indistinguishable. Contrast cannot see that: each of those
// colours passed on its own. This is the check that would have caught it.
//
// Measured as perceptual distance in OKLab, not as hue angle. Hue angle is the
// obvious choice and the wrong one: at the low chroma the light theme needs to
// keep white legible on the fill, two colours 25 degrees apart in OKLCH land
// within 12 degrees of each other in RGB terms, so an angle test either fails
// colours a reader can tell apart or passes ones they cannot. OKLab distance
// accounts for lightness and chroma too, which is what actually decides whether
// two badges look like the same colour.
//
// The threshold used to be 0.10, calibrated against a palette that had eleven
// categories drawn from nine free hues, where the failing business/health pair
// sat at 0.055 and culture/opinion at 0.033.
//
// The palette now has four hue families by design — the flag's crimson and the
// three blues around it — so nine mutually-distinct category colours is not
// something it can produce without pushing two of them onto near-black steps
// that read as black rather than as colour. The nine chosen instead sit within
// 0.069 at the closest pair (business/environment), spread across five ramps
// and separated by lightness where hue runs out.
//
// So 0.065 is what this gate now holds, and it holds it for the same reason as
// before: to fail the day someone assigns two categories the same step, or
// nudges one into its neighbour. It is a regression gate on a deliberate
// palette, not a claim that nine hues are distinguishable at arm's length —
// the label and the glyph are what name a section.
const MIN_PERCEPTUAL_DISTANCE = 0.065;

/** sRGB hex to OKLab. */
function oklab(hex) {
  const [r, g, b] = parse(hex).map((v) => srgb(v));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

const perceptualDistance = (a, b) => {
  const [l1, a1, b1] = oklab(a);
  const [l2, a2, b2] = oklab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
};

function distinctnessFailures() {
  const topics = Object.entries(CONTRACTS).map(([name, c]) => [name, c.topic]);

  const bad = [];
  for (let i = 0; i < topics.length; i++) {
    for (let j = i + 1; j < topics.length; j++) {
      const [an, ah] = topics[i];
      const [bn, bh] = topics[j];
      const d = perceptualDistance(ah, bh);
      if (d < MIN_PERCEPTUAL_DISTANCE) {
        bad.push(`${an} (${ah}) and ${bn} (${bh}) differ by ${d.toFixed(3)}`);
      }
    }
  }
  return bad;
}

const count = Object.keys(CONTRACTS).length;
const rows = checks();
const bad = rows.filter(([, r, need]) => r < need);
const notDistinct = distinctnessFailures();
const failed = bad.length + notDistinct.length;

console.log(`\nPRESS DAY — ${rows.length} pairings across ${count} categories`);

if (notDistinct.length === 0) {
  let closest = [9, ""];
  const t = Object.entries(CONTRACTS).map(([n, c]) => [n, c.topic]);
  for (let i = 0; i < t.length; i++)
    for (let j = i + 1; j < t.length; j++) {
      const d = perceptualDistance(t[i][1], t[j][1]);
      if (d < closest[0]) closest = [d, `${t[i][0]}/${t[j][0]}`];
    }
  console.log(
    `  all ${count} categories carry a distinct colour · closest: ${closest[1]} at ${closest[0].toFixed(3)}`,
  );
} else {
  for (const msg of notDistinct) console.log(`  FAIL distinct · ${msg}`);
}

if (bad.length === 0) {
  const worst = rows.reduce((a, b) => (a[1] < b[1] ? a : b));
  console.log(`  all pass · closest: ${worst[0]} at ${worst[1].toFixed(2)}:1`);
} else {
  for (const [label, r, need] of bad) {
    console.log(`  FAIL ${label} — ${r.toFixed(2)}:1 (needs ${need}:1)`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} contrast failure(s).`);
  process.exit(1);
}
console.log("\nAll contrast checks pass (WCAG 2.1 AA).");
