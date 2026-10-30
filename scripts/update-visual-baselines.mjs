// scripts/update-visual-baselines.mjs
//
// Regenerate tests/visual/__snapshots__ in the environment CI renders in, then
// prove they pass there. Run with `pnpm run test:visual:update:ci`.
//
// Why this exists. The baselines are compared against screenshots taken on
// GitHub's ubuntu runner. Generated on a workstation — even a Linux one — the
// same Chromium lays the same page out a fraction of a pixel differently
// (FreeType and fontconfig defaults, not the browser), and an element
// screenshot whose *dimensions* differ cannot be rescued by maxDiffPixelRatio:
//
//   Expected an image 1216px by 439px, received 1216px by 438px.
//
// That is the newsletter-CTA failure this script was written for: it passed on
// the machine that made the baseline and failed on every CI run. The fix is to
// make the baseline where CI makes its screenshots, not to loosen the check.
//
// It runs the official Playwright image for the exact installed version, on
// Ubuntu 24.04 like the runner, against a filtered copy of the repo. The copy
// goes in as a tar on stdin and the PNGs come back as a tar on stdout — no bind
// mount and no `docker cp`, both of which depend on how the daemon is set up
// (rootless Docker maps container users to subordinate uids and cannot copy into
// a container that has not started). No .env is copied, so no live credential
// enters the container, and the build the visual tests start sees no model keys
// and no database — exactly as in CI. The workstation's node_modules is
// untouched.
//
// Needs Docker. First run downloads the image (several GB).

import { spawnSync } from "node:child_process";
import { closeSync, cpSync, mkdtempSync, openSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { version } = JSON.parse(
  readFileSync(join(repo, "node_modules/@playwright/test/package.json"), "utf8"),
);
const image = process.env.PLAYWRIGHT_IMAGE ?? `mcr.microsoft.com/playwright:v${version}-noble`;

// Never copied: build output, VCS history, other tools' output, and any .env.
const SKIP = new Set(["node_modules", ".next", ".git", "test-results", "playwright-report", ".vercel"]);
const keep = (path) => {
  const name = basename(path);
  if (SKIP.has(name)) return false;
  return !(name === ".env" || (name.startsWith(".env.") && name !== ".env.example"));
};

// stdout carries the result tar, so everything the steps print goes to stderr
// (`1>&2`) and only the final `tar` writes to the saved descriptor 3.
const steps = [
  "set -euo pipefail",
  "mkdir /work",
  "tar -xf - -C /work",
  "cd /work",
  "exec 3>&1 1>&2",
  "corepack enable",
  "pnpm install --frozen-lockfile",
  "pnpm run test:visual:update",
  // The proof: a second, clean run the way CI runs it. Baselines that do not
  // survive this are not baselines.
  "CI=1 pnpm run test:visual",
  "tar -cf - -C tests/visual/__snapshots__ . >&3",
].join("\n");

const root = mkdtempSync(join(tmpdir(), "ekjhalak-visual-"));
let status = 1;
try {
  const work = join(root, "repo");
  cpSync(repo, work, { recursive: true, filter: keep });

  const packed = spawnSync("tar", ["-cf", "-", "-C", work, "."], { maxBuffer: 1 << 30 });
  if (packed.status !== 0) throw new Error(`tar (pack) failed: ${packed.stderr}`);

  console.log(`Using ${image}`);
  const resultPath = join(root, "snapshots.tar");
  const resultFd = openSync(resultPath, "w");
  let run;
  try {
    run = spawnSync("docker", ["run", "--rm", "-i", "--ipc=host", image, "bash", "-c", steps], {
      input: packed.stdout,
      stdio: ["pipe", resultFd, "inherit"],
    });
  } finally {
    closeSync(resultFd);
  }

  if (run.status !== 0) {
    console.error("\nNot copied back: the run inside the container failed.");
  } else {
    const unpacked = spawnSync("tar", ["-xf", resultPath, "-C", join(repo, "tests/visual/__snapshots__")]);
    if (unpacked.status !== 0) throw new Error(`tar (unpack) failed: ${unpacked.stderr}`);
    console.log("\nBaselines regenerated and verified. Review with `git status tests/visual`, then commit the PNGs.");
    status = 0;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
} finally {
  rmSync(root, { recursive: true, force: true });
}
process.exit(status);
