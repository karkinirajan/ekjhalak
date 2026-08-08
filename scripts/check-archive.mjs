#!/usr/bin/env node
// scripts/check-archive.mjs
// The Phase 2 gate, as a command.
//
// The gate is "`select count(*) from articles` grows monotonically across three
// aggregation runs 10+ minutes apart, with /api/news unchanged in shape". This
// script answers the half a machine can answer in one shot — is the archive
// configured, reachable, correctly shaped and correctly locked down — and prints
// the count, so running it three times over half an hour is the whole gate.
//
// It talks to PostgREST exactly the way lib/article-store.ts does, using the same
// two environment variables, because a check that authenticates differently from
// the code proves nothing about the code.
//
// Dependency-free and reads .env itself rather than relying on a shell to export
// it. That is not incidental: this project's database password contains `$`, `&`
// and `^`, so `source .env` silently corrupts it and produces an authentication
// failure that looks exactly like a wrong password. The parser below does no
// expansion.
//
//   node scripts/check-archive.mjs
//   pnpm check:archive

import { readFileSync, existsSync } from "node:fs";

const TIMEOUT_MS = 15_000;

// ── Environment ─────────────────────────────────────────────────────────────

function loadDotenv(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

// .env.local wins over .env, and a real environment variable wins over both —
// the same precedence Next.js applies, so what this checks is what runs.
const env = {
  ...loadDotenv(".env"),
  ...loadDotenv(".env.local"),
  ...process.env,
};

const ORIGIN_RAW = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY =
  env.SUPABASE_PUBLIC_ANON_KEY ??
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  env.SUPABASE_ANON_KEY;

// ── Reporting ───────────────────────────────────────────────────────────────

let failures = 0;
let warnings = 0;

const pass = (label, detail = "") =>
  console.log(`  ok    ${label}${detail ? `  — ${detail}` : ""}`);
const warn = (label, detail = "") => {
  warnings++;
  console.log(`  warn  ${label}${detail ? `  — ${detail}` : ""}`);
};
const fail = (label, detail = "") => {
  failures++;
  console.log(`  FAIL  ${label}${detail ? `  — ${detail}` : ""}`);
};

function section(title) {
  console.log(`\n${title}`);
}

async function rest(path, key, init = {}) {
  const response = await fetch(`${origin}${path}`, {
    ...init,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  const text = await response.text().catch(() => "");
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* not JSON — the raw text is enough for the message */
  }
  return { response, text, json };
}

// ── 1. Configuration ────────────────────────────────────────────────────────

console.log("\nArchive check — the Phase 2 gate\n" + "═".repeat(48));
section("Configuration");

let origin = null;

if (!ORIGIN_RAW) {
  // If DATABASE_URL is present the project ref is already on hand, so name the
  // exact value to paste rather than describing where to find it.
  const ref = env.DATABASE_URL?.match(/(?:postgres\.|db\.)([a-z0-9]{20})/i)?.[1];
  fail(
    "REST origin",
    ref
      ? `neither SUPABASE_URL nor NEXT_PUBLIC_SUPABASE_URL is set — from your ` +
        `DATABASE_URL it should be https://${ref}.supabase.co`
      : "neither SUPABASE_URL nor NEXT_PUBLIC_SUPABASE_URL is set",
  );
} else {
  try {
    const parsed = new URL(ORIGIN_RAW);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      fail(
        "REST origin",
        `${parsed.protocol.replace(":", "")} connection string, not the REST ` +
          "origin — expected https://<ref>.supabase.co",
      );
    } else if (parsed.username || parsed.password) {
      fail("REST origin", "carries credentials; fetch rejects those outright");
    } else {
      origin = parsed.origin;
      pass(
        "REST origin",
        `${origin} (from ${env.SUPABASE_URL ? "SUPABASE_URL" : "NEXT_PUBLIC_SUPABASE_URL"})`,
      );
      if (!env.SUPABASE_URL) {
        warn(
          "origin variable name",
          "found under NEXT_PUBLIC_SUPABASE_URL; SUPABASE_URL is the name the " +
            "code documents, and the server-only one",
        );
      }
    }
  } catch {
    fail("REST origin", "not a URL");
  }
}

if (!SERVICE_KEY) fail("SUPABASE_SERVICE_ROLE_KEY", "not set");
else pass("SUPABASE_SERVICE_ROLE_KEY", `${SERVICE_KEY.length} chars`);

// The check that matters most and costs nothing. A service-role key under a
// NEXT_PUBLIC_ name is inlined into the client bundle at build time and served
// to every visitor — a full database compromise with no error and no symptom.
const exposed = Object.keys(env).filter(
  (k) => k.startsWith("NEXT_PUBLIC_") && /SERVICE_ROLE|SERVICE_KEY|SECRET/i.test(k),
);
if (exposed.length > 0) {
  fail(
    "no secrets under NEXT_PUBLIC_",
    `${exposed.join(", ")} — inlined into the browser bundle; rotate, do not rename`,
  );
} else {
  pass("no secrets under NEXT_PUBLIC_");
}

if (failures > 0 || !origin || !SERVICE_KEY) {
  console.log(
    `\n${"═".repeat(48)}\n${failures} failure(s). The archive is not configured; nothing further can be checked.\n`,
  );
  process.exit(1);
}

// ── 2. Reachability and schema ──────────────────────────────────────────────

section("Connection");

const EXPECTED_COLUMNS = [
  "id",
  "source_url",
  "source_id",
  "source_name",
  "title",
  "summary",
  "original_lang",
  "title_translated",
  "summary_translated",
  "bucket",
  "topic",
  "category",
  "credibility",
  "image_url",
  "published_at",
  "first_seen_at",
  "last_seen_at",
  "coverage_count",
  "alternate_source_ids",
  "canonical_id",
  "enrichment_key",
  "quality",
];

let rows = null;

{
  const { response, json } = await rest("/rest/v1/", SERVICE_KEY);
  if (response.ok) pass("service role authenticates", `HTTP ${response.status}`);
  else fail("service role authenticates", `HTTP ${response.status}`);
  void json;
}

{
  const { response, json } = await rest(
    `/rest/v1/articles?select=${EXPECTED_COLUMNS.join(",")}`,
    SERVICE_KEY,
    { method: "HEAD", headers: { Prefer: "count=exact", Range: "0-0" } },
  );

  if (response.status === 404 || json?.code === "PGRST205") {
    fail(
      "articles table exists",
      "PGRST205 — apply supabase/migrations/*.sql in order",
    );
  } else if (response.status === 400 && json?.code === "PGRST204") {
    fail("every expected column exists", json.message ?? "column missing");
  } else if (!response.ok) {
    fail("articles table readable", `HTTP ${response.status}`);
  } else {
    pass("articles table exists");
    pass(`all ${EXPECTED_COLUMNS.length} expected columns present`);
    const total = response.headers.get("content-range")?.split("/")[1];
    rows = total && total !== "*" ? Number(total) : null;
  }
}

// ── 3. Security posture ─────────────────────────────────────────────────────
//
// RLS is enabled with no policies, which is a deliberate deny-all rather than an
// oversight. Nothing in a browser reads this table; the writer uses the service
// role, which bypasses RLS by design. If that ever silently changed, this is
// where it would show.

section("Security");

if (!ANON_KEY) {
  warn("anon is denied by RLS", "no anon key available to test with");
} else {
  const { response, json } = await rest(
    "/rest/v1/articles?select=id&limit=5",
    ANON_KEY,
  );
  if (Array.isArray(json) && json.length === 0) {
    pass("anon is denied by RLS", "reads an empty set");
  } else if (Array.isArray(json)) {
    fail(
      "anon is denied by RLS",
      `returned ${json.length} row(s) — a policy has been added`,
    );
  } else if (response.status === 401 || response.status === 403) {
    pass("anon is denied by RLS", `HTTP ${response.status}`);
  } else {
    warn("anon is denied by RLS", `unexpected HTTP ${response.status}`);
  }

  const { response: rpc } = await rest(
    "/rest/v1/rpc/prune_article_bodies",
    ANON_KEY,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    },
  );
  if (rpc.status === 401 || rpc.status === 403 || rpc.status === 404) {
    pass("anon cannot call prune_article_bodies", `HTTP ${rpc.status}`);
  } else {
    fail(
      "anon cannot call prune_article_bodies",
      `HTTP ${rpc.status} — a function that empties columns is one request from the public internet`,
    );
  }
}

// ── 4. Contents ─────────────────────────────────────────────────────────────

section("Contents");

console.log(`  rows: ${rows ?? "unknown"}`);

if (rows === 0) {
  warn(
    "the table is empty",
    "expected before the first aggregation run writes to it",
  );
} else if (rows !== null) {
  const { json } = await rest(
    "/rest/v1/articles?select=id,first_seen_at,last_seen_at,enrichment_key," +
      "title_translated,quality&order=first_seen_at.asc&limit=1",
    SERVICE_KEY,
  );
  const oldest = Array.isArray(json) ? json[0] : null;
  if (oldest) {
    console.log(`  oldest first_seen_at: ${oldest.first_seen_at}`);
  }

  // How much of the archive is carrying its own enrichment — the number that
  // decides whether the model quota is being spent on new stories or re-spent
  // on old ones.
  for (const [label, filter] of [
    ["with an enrichment key", "enrichment_key=not.is.null"],
    ["with a translation", "title_translated=not.is.null"],
    ["verified by a model", "quality->>verified=eq.true"],
  ]) {
    const { response } = await rest(
      `/rest/v1/articles?select=id&${filter}`,
      SERVICE_KEY,
      { method: "HEAD", headers: { Prefer: "count=exact", Range: "0-0" } },
    );
    const n = Number(response.headers.get("content-range")?.split("/")[1] ?? 0);
    const share = rows > 0 ? Math.round((n / rows) * 100) : 0;
    console.log(`  ${label}: ${n} (${share}%)`);
  }
}

// ── Verdict ─────────────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(48)}`);
if (failures > 0) {
  console.log(`${failures} failure(s), ${warnings} warning(s).\n`);
  process.exit(1);
}
console.log(
  `All checks passed${warnings ? `, ${warnings} warning(s)` : ""}.\n\n` +
    "The gate is monotonic growth: run this again after the next aggregation\n" +
    "(10+ minutes apart, three times) and confirm `rows` only ever rises.\n",
);
