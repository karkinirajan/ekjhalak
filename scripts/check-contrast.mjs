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
//   1. It measured the wrong foreground. The solid pill prints white on the
//      topic colour, which on the dark theme ran as low as 1.73:1. Only the
//      quiet tone had been checked.
//
//   2. It measured the wrong background. The quiet pill sets topic-coloured
//      text on a 13% wash of that same topic, so the composited background is
//      lighter than --surface. Measuring against bare --surface reported 4.49
//      where the real figure was 3.97.
//
// So: check every pairing, against the background that is actually painted.

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
function themeTokens(pattern) {
  const block = css.match(pattern);
  if (!block) throw new Error(`could not locate theme block: ${pattern}`);
  const tokens = {};
  for (const [, name, value] of block[0].matchAll(
    /--([a-z-]+):\s*(#[0-9a-fA-F]{6})/g,
  )) {
    tokens[name] = value.toLowerCase();
  }
  return tokens;
}

const THEMES = {
  dark: themeTokens(/:root,\s*\n\[data-theme="dark"\][\s\S]*?\n}/),
  light: themeTokens(/\[data-theme="light"\][\s\S]*?\n}/),
};

const TOPICS = [
  "breaking", "politics", "world", "business", "sports", "health",
  "environment", "culture", "technology", "society", "opinion",
];

/** The wash behind quiet-tone pill text — see components/topic-pill.tsx. */
const QUIET_TINT = 0.13;

// ── the pairings the UI actually paints ─────────────────────────────────────
function checksFor(t) {
  const rows = [];

  for (const topic of TOPICS) {
    const c = t[`topic-${topic}`];
    rows.push([
      `solid pill · --topic-ink on ${topic}`,
      ratio(t["topic-ink"], c),
      AA,
    ]);
    rows.push([
      `quiet pill · ${topic} on its own ${QUIET_TINT * 100}% wash`,
      ratio(c, blend(c, t.surface, QUIET_TINT)),
      AA,
    ]);
  }

  rows.push(
    ["body · --ink on --canvas", ratio(t.ink, t.canvas), AA],
    ["body · --ink-soft on --surface", ratio(t["ink-soft"], t.surface), AA],
    ["meta · --ink-muted on --surface", ratio(t["ink-muted"], t.surface), AA],
    ["meta · --ink-muted on --canvas", ratio(t["ink-muted"], t.canvas), AA],
    ["accent · --red on --surface", ratio(t.red, t.surface), AA],
    ["accent · --green on --surface", ratio(t.green, t.surface), AA],
    ["CTA · white on --red-solid", ratio("#ffffff", t["red-solid"]), AA],
    ["CTA · --red-solid fill vs --canvas", ratio(t["red-solid"], t.canvas), AA_UI],
    ["focus ring · --red vs --canvas", ratio(t.red, t.canvas), AA_UI],
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
// The threshold is calibrated against the palette that failed: the old
// business/health pair sat at 0.055 and the old culture/society pair at 0.033.
// 0.10 rejects both comfortably and passes every pair in the current palette.
const MIN_PERCEPTUAL_DISTANCE = 0.1;

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

function distinctnessFailures(tokens) {
  const topics = Object.entries(tokens)
    .filter(([k]) => k.startsWith("topic-") && k !== "topic-ink")
    .map(([k, v]) => [k.replace("topic-", ""), v]);

  const bad = [];
  for (let i = 0; i < topics.length; i++) {
    for (let j = i + 1; j < topics.length; j++) {
      const [an, ah] = topics[i];
      const [bn, bh] = topics[j];
      const d = perceptualDistance(ah, bh);
      if (d < MIN_PERCEPTUAL_DISTANCE) {
        bad.push([`${an} (${ah}) and ${bn} (${bh}) differ by ${d.toFixed(3)}`, d]);
      }
    }
  }
  return bad;
}

let failed = 0;
for (const [name, tokens] of Object.entries(THEMES)) {
  const rows = checksFor(tokens);
  const bad = rows.filter(([, r, need]) => r < need);
  failed += bad.length;

  const notDistinct = distinctnessFailures(tokens);
  failed += notDistinct.length;

  console.log(`\n${name.toUpperCase()} — ${rows.length} pairings`);
  if (notDistinct.length === 0) {
    console.log("  all 11 categories carry a distinct hue");
  } else {
    for (const [msg] of notDistinct) console.log(`  FAIL distinct · ${msg}`);
  }
  if (bad.length === 0) {
    const worst = rows.reduce((a, b) => (a[1] < b[1] ? a : b));
    console.log(`  all pass · closest: ${worst[0]} at ${worst[1].toFixed(2)}:1`);
  } else {
    for (const [label, r, need] of bad) {
      console.log(`  FAIL ${label} — ${r.toFixed(2)}:1 (needs ${need}:1)`);
    }
  }
}

if (failed > 0) {
  console.error(`\n${failed} contrast failure(s).`);
  process.exit(1);
}
console.log("\nAll contrast checks pass (WCAG 2.1 AA).");
