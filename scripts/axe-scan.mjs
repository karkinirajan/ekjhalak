#!/usr/bin/env node
// scripts/axe-scan.mjs
//
// Run axe-core against a live URL and print violations by severity.
//
//   node scripts/axe-scan.mjs https://ekjhalak.news/ [--out audit/baseline/axe-home.json]
//
// Deliberately dependency-free. @axe-core/cli wants chromedriver and a devDependency
// for something that runs a handful of times a release; this drives the Chrome that
// is already installed over the DevTools protocol, using the WebSocket global Node 22
// ships, and reads axe-core out of whichever npx cache Lighthouse populated.
//
// Companion to check-contrast.mjs, and it catches what that script structurally
// cannot: check-contrast reads the token pairs as authored, so a ratio broken at
// render time by an `opacity-*` utility sitting on top of a passing pair is
// invisible to it. This scans what the browser actually painted.

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { spawn } from "node:child_process";

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
const CHROME = process.env.CHROME_PATH ?? "google-chrome-stable";

/** axe.min.js, from wherever npx last unpacked Lighthouse. */
function findAxe() {
  if (process.env.AXE_PATH) return process.env.AXE_PATH;
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
    "axe-core not found. Run `npx lighthouse --version` once to populate the npx\n" +
      "cache, or point AXE_PATH at an axe.min.js.",
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
