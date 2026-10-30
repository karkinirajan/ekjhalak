// scripts/test-digest-db.mjs
//
// End-to-end check of the daily digest against a real, throwaway Postgres, with
// Resend faked. Run with `pnpm run test:digest`.
//
// It exists because the part of the digest that decides who gets mailed — the
// claim query, its handling of retries, concurrency and expired claims — is SQL,
// and `node --test` over pure functions cannot say whether it is right. This
// found a real bug the unit tests could not: a permanently rejected address was
// re-claimed by the same run in a loop until the time budget ran out.
//
// Self-contained: it initialises its own cluster in a temp directory, applies
// db/migrations and the articles table from db/schema.sql, and removes all of it
// afterwards. Nothing touches DATABASE_URL, Supabase or the real Resend. It is
// not in CI because the runner needs Postgres server binaries; where they are
// missing it says so and exits 0.

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// ── find Postgres server binaries ───────────────────────────────────────────
function findBin(name) {
  const onPath = spawnSync("sh", ["-c", `command -v ${name}`], { encoding: "utf8" }).stdout.trim();
  if (onPath) return onPath;
  for (const root of ["/usr/lib/postgresql", "/usr/local/pgsql", "/opt/homebrew/opt"]) {
    if (!existsSync(root)) continue;
    for (const v of readdirSync(root).sort().reverse()) {
      for (const p of [join(root, v, "bin", name), join(root, v, name)]) if (existsSync(p)) return p;
    }
  }
  return null;
}
const initdb = findBin("initdb");
const pgCtl = findBin("pg_ctl");
if (!initdb || !pgCtl) {
  console.log("skipped: initdb / pg_ctl not found — install the PostgreSQL server package to run this.");
  process.exit(0);
}

const freePort = () =>
  new Promise((ok, no) => {
    const s = createServer();
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => ok(port));
    });
    s.on("error", no);
  });

const tmp = mkdtempSync(join(tmpdir(), "ekjhalak-digest-"));
const dataDir = join(tmp, "data");
const port = await freePort();
let started = false;

const teardown = () => {
  if (started) {
    try {
      execFileSync(pgCtl, ["-D", dataDir, "-m", "immediate", "stop"], { stdio: "ignore" });
    } catch {
      /* already down */
    }
  }
  rmSync(tmp, { recursive: true, force: true });
};
process.on("exit", teardown);
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => process.exit(130));

execFileSync(initdb, ["-D", dataDir, "-A", "trust", "-U", "postgres", "--no-locale", "-E", "UTF8"], { stdio: "ignore" });
execFileSync(
  pgCtl,
  ["-D", dataDir, "-o", `-p ${port} -c listen_addresses=127.0.0.1 -c unix_socket_directories=${tmp}`, "-l", join(tmp, "pg.log"), "-w", "start"],
  { stdio: "ignore" },
);
started = true;

const DB = `postgresql://postgres@127.0.0.1:${port}/ekjhalak_test`;
Object.assign(process.env, {
  DATABASE_URL: DB,
  RESEND_API_KEY: "re_fake",
  NEWSLETTER_SECRET: "test-secret-key-at-least-16-chars",
  PUBLISH_POLICY: "all",
  NEXT_PUBLIC_SITE_URL: "https://ekjhalak.news",
  CRON_SECRET: "cron-secret-for-tests-0123456789",
  REVALIDATE_SECRET: "reval-secret-for-tests-0123456789",
});

let pass = 0;
let fail = 0;
const check = (name, ok, detail = "") => {
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  -> ${detail}`}`);
};

// ── database ────────────────────────────────────────────────────────────────
const admin = new pg.Client({ connectionString: `postgresql://postgres@127.0.0.1:${port}/postgres` });
await admin.connect();
await admin.query("CREATE DATABASE ekjhalak_test");
await admin.end();

const db = new pg.Client({ connectionString: DB });
await db.connect();

// Migrations as shipped, applied twice: they must be re-runnable. Once without
// Supabase's roles, once with them, because the REVOKE branch only runs when they exist.
const migrations = readdirSync(join(REPO, "db/migrations")).filter((f) => f.endsWith(".sql")).sort();
for (const f of migrations) await db.query(readFileSync(join(REPO, "db/migrations", f), "utf8"));
await db.query("CREATE ROLE anon NOLOGIN");
await db.query("CREATE ROLE authenticated NOLOGIN");
for (const f of migrations) await db.query(readFileSync(join(REPO, "db/migrations", f), "utf8"));
check("migrations apply, and re-apply (with Supabase roles present)", true);

const anonCanRead = (
  await db.query("SELECT has_table_privilege('anon', 'public.subscribers', 'SELECT') AS a, has_table_privilege('anon', 'public.digest_deliveries', 'SELECT') AS d")
).rows[0];
check("anon has no access to subscriber or ledger tables", !anonCanRead.a && !anonCanRead.d, JSON.stringify(anonCanRead));

const schema = readFileSync(join(REPO, "db/schema.sql"), "utf8");
await db.query(schema.match(/CREATE TABLE public\.articles \([\s\S]*?\n\);/)[0]);
await db.query("ALTER TABLE public.articles ADD CONSTRAINT articles_pkey PRIMARY KEY (id)");

const ago = (h) => `now() - interval '${h} hours'`;
const article = (id, bucket, hours, coverage, title = `Headline ${id}`) =>
  db.query(
    `INSERT INTO articles (id, source_url, source_id, source_name, title, summary, original_lang, title_translated, summary_translated, bucket, topic, published_at, coverage_count)
     VALUES ($1,$2,'src','Source <b>X</b>',$3,'A short summary.','en',$4,$5,$6,'society',${ago(hours)},$7)`,
    [id, `https://pub.example/${id}`, title, `नेपाली ${id}`, `सारांश ${id}`, bucket, coverage],
  );
await article("n1", "national", 1, 3);
await article("n2", "national", 5, 1);
await article("n_old", "national", 30, 9); // outside 24h: must never appear
await article("w1", "international", 2, 2);
await article("w2", "international", 3, 1, "Evil <script>alert(1)</script>");

const subscribe = (email, status, lang = "en") =>
  db.query(
    "INSERT INTO subscribers (email, status, language, confirmed_at) VALUES ($1,$2,$3, CASE WHEN $2='confirmed' THEN now() END) ON CONFLICT (email) DO UPDATE SET status = $2, unsubscribed_at = NULL",
    [email, status, lang],
  );
await subscribe("a@example.com", "confirmed", "en");
await subscribe("b@example.com", "confirmed", "np");
await subscribe("c@example.com", "confirmed", "en");
await subscribe("pending@example.com", "pending");
await subscribe("gone@example.com", "unsubscribed");

// ── fake Resend ─────────────────────────────────────────────────────────────
let mode = "ok";
let calls = [];
const delivered = new Map(); // email -> times accepted
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (!u.startsWith("https://api.resend.com")) return realFetch(url, init);
  const path = u.replace("https://api.resend.com", "");
  const body = init.body ? JSON.parse(init.body) : null;
  calls.push({ path, body, key: init.headers?.["Idempotency-Key"], auth: init.headers?.authorization });
  const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status });
  if (path.startsWith("/audiences")) return json({ data: [{ id: "aud_1", name: "EkJhalak Daily Brief" }] });
  const accept = (m) => delivered.set(m.to[0], (delivered.get(m.to[0]) ?? 0) + 1);
  if (mode === "429") return json({ name: "rate_limit_exceeded" }, 429);
  if (path === "/emails/batch") {
    if (mode === "bad-address" && body.some((m) => m.to[0].startsWith("bad"))) return json({ name: "validation_error" }, 422);
    body.forEach(accept);
    return json({ data: body.map((_, i) => ({ id: `id${i}` })) });
  }
  if (path === "/emails") {
    if (mode === "bad-address" && body.to[0].startsWith("bad")) return json({ name: "validation_error" }, 422);
    accept(body);
    return json({ id: "single" });
  }
  return json({}, 404);
};

const { runDigest } = await import(join(REPO, "lib/digest-run.ts"));
const { unsubscribeSubscriber } = await import(join(REPO, "lib/subscribers.ts"));
const { createUnsubscribeToken, createConfirmationToken, verifyUnsubscribeToken } = await import(join(REPO, "lib/subscribe-token.ts"));

const day = (n) => new Date(Date.UTC(2026, 9, 31 + n, 2, 0, 0)); // distinct Nepal dates
const ledger = async (d) => (await db.query("SELECT status, count(*)::int n FROM digest_deliveries WHERE digest_date = $1 GROUP BY 1", [d])).rows;
const reset = () => {
  calls = [];
  delivered.clear();
};

// ── the run ─────────────────────────────────────────────────────────────────
reset();
let r = await runDigest({ now: day(0), dry: true });
check("dry run reports stories and recipients, claims nothing",
  r.status === "dry-run" && r.stories === 4 && r.recipients === 3 && calls.length === 0 &&
  (await db.query("SELECT count(*)::int n FROM digest_deliveries")).rows[0].n === 0, JSON.stringify(r));

reset();
r = await runDigest({ now: day(0) });
check("first run sends to exactly the 3 confirmed subscribers", r.status === "sent" && r.claimed === 3 && r.sent === 3 && r.failed === 0, JSON.stringify(r));
check("pending and unsubscribed addresses are never mailed", !delivered.has("pending@example.com") && !delivered.has("gone@example.com"), [...delivered.keys()].join());
check("each confirmed subscriber received exactly one email", ["a@example.com", "b@example.com", "c@example.com"].every((e) => delivered.get(e) === 1));
const batch = calls.find((c) => c.path === "/emails/batch");
check("one batch request, with an idempotency key and bearer auth", calls.filter((c) => c.path === "/emails/batch").length === 1 && /^digest-2026-/.test(batch?.key ?? "") && batch.auth === "Bearer re_fake", `${batch?.key}`);
const msgA = batch.body.find((m) => m.to[0] === "a@example.com");
const msgB = batch.body.find((m) => m.to[0] === "b@example.com");
check("Nepali subscriber gets a Nepali subject and headlines", msgB.subject.startsWith("एक झलक") && msgB.html.includes("नेपाली n1"), msgB.subject);
check("English subscriber gets English", msgA.subject.startsWith("EkJhalak daily brief") && msgA.html.includes("Headline n1"));
check("stories older than 24h are excluded", !msgA.html.includes("n_old"));
check("publisher markup is escaped in the sent HTML", !msgA.html.includes("<script>") && !msgA.html.includes("<b>X</b>") && msgA.html.includes("&lt;script&gt;"));
check("one-click unsubscribe headers are on every message", batch.body.every((m) => m.headers["List-Unsubscribe-Post"] === "List-Unsubscribe=One-Click" && m.headers["List-Unsubscribe"].startsWith("<https://ekjhalak.news/api/unsubscribe?token=")));
const tok = decodeURIComponent(msgA.headers["List-Unsubscribe"].match(/token=([^>]+)>/)[1]);
check("the unsubscribe token in each message verifies to that recipient", JSON.stringify(verifyUnsubscribeToken(tok)) === JSON.stringify({ ok: true, email: "a@example.com" }));
check("the body link and the plain-text part carry the token too", msgA.html.includes("/unsubscribe?token=") && msgA.text.includes("/unsubscribe?token="));
check("ledger shows 3 sent", JSON.stringify(await ledger("2026-10-31")) === JSON.stringify([{ status: "sent", n: 3 }]), JSON.stringify(await ledger("2026-10-31")));

reset();
r = await runDigest({ now: day(0) });
check("a second trigger the same morning finds nothing to do", r.status === "skipped" && r.reason === "nothing-to-send" && calls.length === 0, JSON.stringify(r));
await subscribe("late@example.com", "confirmed");
reset();
r = await runDigest({ now: day(0) });
check("a subscriber who joins mid-window gets only their own copy", r.sent === 1 && delivered.size === 1 && delivered.get("late@example.com") === 1, JSON.stringify([...delivered]));

reset();
mode = "429";
r = await runDigest({ now: day(1) });
check("a 429 stops the run, mails nobody, and reports more remaining", r.status === "partial" && r.sent === 0 && r.moreRemaining === true && delivered.size === 0, JSON.stringify(r));
check("throttled recipients are left 'failed' so the next trigger retakes them", (await ledger("2026-11-01")).some((x) => x.status === "failed" && x.n === 4), JSON.stringify(await ledger("2026-11-01")));
reset();
mode = "ok";
r = await runDigest({ now: day(1) });
check("the next trigger finishes the job", r.status === "sent" && r.sent === 4, JSON.stringify(r));
check("nobody got two copies across the retry", [...delivered.values()].every((n) => n === 1) && delivered.size === 4);

await subscribe("bad@example.com", "confirmed");
reset();
mode = "bad-address";
const t0 = Date.now();
r = await runDigest({ now: day(2) });
check("one rejected address: single-send fallback, only that address fails, and the run ends",
  r.status === "partial" && r.failed === 1 && r.sent === 4 && r.moreRemaining === false && !delivered.has("bad@example.com") && delivered.size === 4 && Date.now() - t0 < 15_000,
  JSON.stringify(r));
const rows = (await db.query("SELECT s.email, d.status FROM digest_deliveries d JOIN subscribers s ON s.id=d.subscriber_id WHERE digest_date='2026-11-02'")).rows;
check("the bad address is recorded as failed, the rest as sent", rows.filter((x) => x.status === "failed").map((x) => x.email).join() === "bad@example.com" && rows.filter((x) => x.status === "sent").length === 4, JSON.stringify(rows));
await db.query("UPDATE subscribers SET status='bounced' WHERE email='bad@example.com'");

reset();
mode = "ok";
const both = await Promise.all([runDigest({ now: day(3) }), runDigest({ now: day(3) })]);
check("two simultaneous runs mail each subscriber exactly once", [...delivered.values()].every((n) => n === 1) && delivered.size === 4, JSON.stringify([...delivered]) + JSON.stringify(both));

const un = await unsubscribeSubscriber("c@example.com");
check("unsubscribing succeeds and is logged as an event", un.ok && (await db.query("SELECT count(*)::int n FROM subscription_events e JOIN subscribers s ON s.id=e.subscriber_id WHERE s.email='c@example.com' AND e.event='unsubscribed'")).rows[0].n === 1);
check("unsubscribing twice, or an unknown address, is still a success", (await unsubscribeSubscriber("c@example.com")).ok && (await unsubscribeSubscriber("never@example.com")).ok);
reset();
await runDigest({ now: day(4) });
check("an unsubscribed reader is not mailed the next morning", !delivered.has("c@example.com") && delivered.size === 3, JSON.stringify([...delivered.keys()]));

const idOf = async (email) => (await db.query("SELECT id FROM subscribers WHERE email=$1", [email])).rows[0].id;
await db.query(
  "INSERT INTO digest_deliveries (digest_date, subscriber_id, status, attempted_at) VALUES ('2026-11-06',$1,'sending', now() - interval '1 minute'), ('2026-11-06',$2,'sending', now() - interval '20 minutes')",
  [await idOf("a@example.com"), await idOf("b@example.com")],
);
reset();
await runDigest({ now: day(6) });
check("a fresh claim is respected; a stale one is taken over", delivered.get("b@example.com") === 1 && !delivered.has("a@example.com") && delivered.has("late@example.com"), JSON.stringify([...delivered.keys()]));

// ── the routes ──────────────────────────────────────────────────────────────
process.env.NODE_ENV = "production";
const { NextRequest } = await import("next/server");
const unsub = await import(join(REPO, "app/api/unsubscribe/route.ts"));
const cron = await import(join(REPO, "app/api/cron/digest/route.ts"));
const reval = await import(join(REPO, "app/api/revalidate/route.ts"));
const req = (url, init) => new NextRequest(url, init);
const base = "https://ekjhalak.news";
const status = async () => (await db.query("SELECT status FROM subscribers WHERE email='route@example.com'")).rows[0].status;

await subscribe("route@example.com", "confirmed");
const token = createUnsubscribeToken("route@example.com");
const q = encodeURIComponent(token);
let res = await unsub.GET(req(`${base}/api/unsubscribe?token=${q}&lang=np`));
check("GET redirects (relative, same-origin) to the confirmation page", res.status === 303 && res.headers.get("location") === `/unsubscribe?token=${q}&lang=np`, `${res.status} ${res.headers.get("location")}`);
check("GET does not unsubscribe anyone (mail scanners fetch links)", (await status()) === "confirmed", await status());
res = await unsub.POST(req(`${base}/api/unsubscribe?token=${q}`, { method: "POST", body: "List-Unsubscribe=One-Click", headers: { "content-type": "application/x-www-form-urlencoded", "x-forwarded-for": "9.9.9.1" } }));
let body = await res.json();
check("one-click POST unsubscribes and answers JSON 200", res.status === 200 && body.ok === true && (await status()) === "unsubscribed", `${res.status} ${JSON.stringify(body)}`);
res = await unsub.POST(req(`${base}/api/unsubscribe?token=${q}&then=page&lang=np`, { method: "POST", headers: { "x-forwarded-for": "9.9.9.2" } }));
check("a form POST redirects to the done page", res.status === 303 && res.headers.get("location") === `/unsubscribe?status=done&lang=np`, `${res.status} ${res.headers.get("location")}`);
res = await unsub.POST(req(`${base}/api/unsubscribe?token=garbage`, { method: "POST", headers: { "x-forwarded-for": "9.9.9.3" } }));
check("a bad token is a 400", res.status === 400, String(res.status));
res = await unsub.POST(req(`${base}/api/unsubscribe?token=garbage&then=page`, { method: "POST", headers: { "x-forwarded-for": "9.9.9.4" } }));
check("a bad token from the form redirects to the invalid page", res.status === 303 && res.headers.get("location") === `/unsubscribe?status=invalid&lang=en`, res.headers.get("location"));
res = await unsub.POST(req(`${base}/api/unsubscribe?token=${encodeURIComponent(createConfirmationToken("route@example.com"))}`, { method: "POST", headers: { "x-forwarded-for": "9.9.9.5" } }));
check("a confirmation token cannot be used to unsubscribe", res.status === 400, String(res.status));
let last;
for (let i = 0; i < 22; i++) last = await unsub.POST(req(`${base}/api/unsubscribe?token=x`, { method: "POST", headers: { "x-forwarded-for": "9.9.9.7" } }));
check("repeated attempts from one client are rate limited", last.status === 429, String(last.status));

await db.query("DELETE FROM articles");
await article("r1", "national", 2, 1);
res = await cron.GET(req(`${base}/api/cron/digest`));
check("cron GET without credentials is refused", res.status === 401, String(res.status));
res = await cron.GET(req(`${base}/api/cron/digest`, { headers: { authorization: "Bearer wrong" } }));
check("cron GET with the wrong secret is refused", res.status === 401, String(res.status));
const ledgerBefore = (await db.query("SELECT count(*)::int n FROM digest_deliveries")).rows[0].n;
res = await cron.GET(req(`${base}/api/cron/digest?dry=1`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }));
body = await res.json();
check("cron GET with CRON_SECRET and ?dry=1 reports without sending", res.status === 200 && body.status === "dry-run" && body.stories === 1, `${res.status} ${JSON.stringify(body)}`);
res = await cron.POST(req(`${base}/api/cron/digest?dry=1&secret=${process.env.CRON_SECRET}`, { method: "POST" }));
check("the GET secret does not open the POST door", res.status === 401, String(res.status));
check("dry runs wrote nothing to the ledger", ledgerBefore === (await db.query("SELECT count(*)::int n FROM digest_deliveries")).rows[0].n);
const keep = process.env.CRON_SECRET;
delete process.env.CRON_SECRET;
res = await cron.GET(req(`${base}/api/cron/digest`));
check("with no CRON_SECRET configured, production fails closed", res.status === 401, String(res.status));
process.env.CRON_SECRET = keep;
res = await reval.GET(req(`${base}/api/revalidate`));
check("revalidate GET without credentials is still refused", res.status === 401, String(res.status));

// ── nothing to send / unconfigured ──────────────────────────────────────────
await db.query("DELETE FROM articles");
reset();
r = await runDigest({ now: day(7) });
check("a day with no stories sends nothing and claims no one", r.status === "skipped" && r.reason === "no-stories" && calls.length === 0 && (await ledger("2026-11-07")).length === 0, JSON.stringify(r));
delete process.env.RESEND_API_KEY;
r = await runDigest({ now: day(7) });
check("a missing mail key is reported as a misconfiguration", r.status === "skipped" && r.reason === "no-mail-transport", JSON.stringify(r));

console.log(`\n${pass} passed, ${fail} failed`);
await db.end();
process.exit(fail ? 1 : 0);
