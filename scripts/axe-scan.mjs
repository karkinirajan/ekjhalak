#!/usr/bin/env node
// scripts/axe-scan.mjs
//
// Run axe-core against a live URL and print violations by severity.
//
//   node scripts/axe-scan.mjs https://ekjhalak.news/ [--out audit/baseline/axe-home.json]
//
// Drives the Chrome that is already installed over the DevTools protocol, using
// the WebSocket global Node 22 ships. @axe-core/cli would additionally want
// chromedriver; this needs only axe-core itself, which is a devDependency so a
// CI runner resolves the same pinned version every time. (It used to take
// whatever axe-core an npx cache happened to hold — fine on a laptop that had
// run Lighthouse, and nowhere else.)
//
// Companion to check-contrast.mjs, and it catches what that script structurally
// cannot: check-contrast reads the token pairs as authored, so a ratio broken at
// render time by an `opacity-*` utility sitting on top of a passing pair is
// invisible to it. This scans what the browser actually painted.

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith("--"));
const outIndex = args.indexOf("--out");
const outPath = outIndex === -1 ? null : args[outIndex + 1];
const settleMs = Number.parseInt(
  args.find((a) => a.startsWith("--settle="))?.split("=")[1] ?? "12000",
  10,
);

if (!url) {
  console.error("usage: node scripts/axe-scan.mjs <url> [--out file.json] [--settle=ms]");
  process.exit(2);
}

const PORT = 9333;

/**
 * The Chrome to drive.
 *
 * A list rather than one name because the binary is called something different
 * almost everywhere: `google-chrome-stable` on Arch and Debian, `google-chrome`
 * on the GitHub Actions runner images, `chromium` on Alpine and most Nix
 * setups. Hard-coding the first of those meant this script worked on the
 * machine it was written on and would have failed on the CI runner it was about
 * to become a gate for.
 *
 * CHROME_PATH still wins outright, so an unusual install needs no change here.
 */
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "google-chrome-stable",
  "google-chrome",
  "chromium",
  "chromium-browser",
].filter(Boolean);

function resolveChrome() {
  for (const candidate of CHROME_CANDIDATES) {
    // An absolute path is taken at its word; a bare name is looked up on PATH.
    if (candidate.includes("/")) {
      if (existsSync(candidate)) return candidate;
      continue;
    }
    // `command -v` rather than `which`: it is POSIX, built into every shell,
    // and present on minimal images where `which` is a package that may not be.
    const found = spawnSync("sh", ["-c", `command -v ${candidate}`], {
      encoding: "utf8",
    });
    if (found.status === 0 && found.stdout.trim()) return candidate;
  }
  return null;
}

const CHROME = resolveChrome();
if (!CHROME) {
  console.error(
    `no Chrome found. Tried: ${CHROME_CANDIDATES.join(", ")}.\n` +
      "Install Chrome or Chromium, or set CHROME_PATH.",
  );
  process.exit(2);
}

/**
 * axe.min.js.
 *
 * Resolved from node_modules first. This used to scavenge it out of whichever
 * npx cache Lighthouse had last populated, which worked on a machine that had
 * run Lighthouse and nowhere else — so the moment this became a CI gate it
 * would have failed on every fresh runner, for a missing cache rather than for
 * an accessibility problem.
 *
 * axe-core is a devDependency now. That gives up the script's dependency-free
 * property, and the trade is worth making once a gate depends on it: a
 * pinned version in the lockfile is also a scan that cannot silently change
 * its findings when someone else's npx cache moves on.
 *
 * The npx cache is still searched as a fallback, and AXE_PATH still overrides
 * both, so an existing local setup keeps working.
 */
function findAxe() {
  if (process.env.AXE_PATH) return process.env.AXE_PATH;

  try {
    return createRequire(import.meta.url).resolve("axe-core/axe.min.js");
  } catch {
    // Fall through to the cache scan below.
  }

  const cache = join(homedir(), ".npm", "_npx");
  if (!existsSync(cache)) return null;
  for (const dir of readdirSync(cache)) {
    const candidate = join(cache, dir, "node_modules", "axe-core", "axe.min.js");
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

const axePath = findAxe();
if (!axePath) {
  console.error(
    "axe-core not found. Run `pnpm install`, or point AXE_PATH at an axe.min.js.",
  );
  process.exit(2);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(
  CHROME,
  [
    `--remote-debugging-port=${PORT}`,
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--user-data-dir=/tmp/ekjhalak-axe-profile",
    "about:blank",
  ],
  { stdio: "ignore" },
);
chrome.on("error", (err) => {
  console.error(`could not launch ${CHROME}: ${err.message}`);
  process.exit(2);
});

async function openTarget() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(
        `http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`,
        { method: "PUT" },
      );
      if (res.ok) return res.json();
    } catch {
      // Chrome is still binding the port.
    }
    await sleep(500);
  }
  throw new Error("Chrome never answered on the debugging port");
}

function cdp(ws) {
  let nextId = 1;
  const pending = new Map();
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    const entry = msg.id && pending.get(msg.id);
    if (!entry) return;
    pending.delete(msg.id);
    if (msg.error) entry.reject(new Error(JSON.stringify(msg.error)));
    else entry.resolve(msg.result);
  });
  return (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
}

const target = await openTarget();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
const send = cdp(ws);

const evaluate = (expression, awaitPromise = false) =>
  send("Runtime.evaluate", {
    expression,
    awaitPromise,
    returnByValue: true,
    allowUnsafeEvalBlockedByCSP: true,
  });

await send("Page.enable");
await send("Runtime.enable");
await send("Page.navigate", { url });
// The feed renders client-side after hydration; scanning at load would scan a
// skeleton and report a clean bill of health for a page nobody sees.
await sleep(settleMs);

await evaluate(readFileSync(axePath, "utf8"));
const { result } = await evaluate(
  `axe.run(document, { resultTypes: ["violations"] }).then(r => JSON.stringify({
     url: r.url,
     testEngine: r.testEngine,
     timestamp: r.timestamp,
     violations: r.violations.map(v => ({
       id: v.id, impact: v.impact, help: v.help, helpUrl: v.helpUrl,
       tags: v.tags, nodes: v.nodes.length,
       targets: v.nodes.slice(0, 5).map(n => n.target.join(" ")),
       sample: v.nodes.slice(0, 2).map(n => n.html.slice(0, 220)),
     })),
   }))`,
  true,
);

ws.close();
chrome.kill();

if (result.subtype === "error") {
  console.error(result.description);
  process.exit(1);
}

const report = JSON.parse(result.value);
if (outPath) writeFileSync(outPath, JSON.stringify(report, null, 2));

const order = ["critical", "serious", "moderate", "minor"];
const counts = Object.fromEntries(order.map((k) => [k, 0]));
for (const v of report.violations) counts[v.impact ?? "minor"]++;

console.log(`axe-core ${report.testEngine.version} · ${report.url}`);
console.log(
  `${report.violations.length} violation(s) — ` +
    order.map((k) => `${k} ${counts[k]}`).join(", "),
);
for (const v of report.violations) {
  console.log(`\n  [${v.impact}] ${v.id} · ${v.nodes} node(s)`);
  console.log(`  ${v.help}`);
  for (const t of v.targets) console.log(`    ${t}`);
}

// Critical and serious fail the run; moderate and minor are reported and tolerated.
process.exit(counts.critical + counts.serious > 0 ? 1 : 0);
