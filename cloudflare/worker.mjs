// cloudflare/worker.mjs
// Edge entrypoint for Cloudflare Workers Builds (`npx wrangler deploy`).
//
// Two jobs:
//   1. `scheduled` — triggers on-demand feed revalidation (`/api/revalidate`)
//      when a Cron Trigger is attached in Cloudflare.
//   2. `fetch`     — proxies requests to the canonical origin while forwarding
//      `CF-Connecting-IP` in `X-Forwarded-For` so `lib/rate-limit.ts` buckets
//      per visitor rather than per edge node.

const DEFAULT_ORIGIN = "https://ekjhalak.news";

// Cron Trigger expressions that send the daily digest, in UTC: 01:15, 01:30 and
// 01:45 are 07:00, 07:15 and 07:30 in Nepal (UTC+5:45).
//
// Three triggers rather than one on purpose. Each run claims only the readers who
// have not had today's digest, so the second and third find nothing to do — but
// if the first was cut short by a time limit or a provider throttle, they finish
// it. Add all three under Workers → ekjhalak → Settings → Triggers → Cron
// Triggers; the expressions there must match these strings exactly.
const DIGEST_CRONS = new Set(["15 1 * * *", "30 1 * * *", "45 1 * * *"]);

function resolveOrigin(env) {
  const raw = typeof env?.ORIGIN_URL === "string" ? env.ORIGIN_URL.trim() : "";
  return (raw || DEFAULT_ORIGIN).replace(/\/$/, "");
}

const worker = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = resolveOrigin(env);

    if (url.pathname === "/__worker/health") {
      return Response.json({
        ok: true,
        worker: "ekjhalak",
        origin,
        timestamp: new Date().toISOString(),
      });
    }

    const upstream = new URL(url.pathname + url.search, origin);

    // Guard against a proxy loop if the Worker is bound directly to the same
    // hostname as `ORIGIN_URL` without a distinct upstream origin configured.
    if (upstream.hostname === url.hostname && !env?.ORIGIN_URL) {
      return fetch(request);
    }

    const headers = new Headers(request.headers);
    const clientIp = request.headers.get("cf-connecting-ip");
    if (clientIp) {
      const prior = headers.get("x-forwarded-for");
      headers.set("x-forwarded-for", prior ? `${clientIp}, ${prior}` : clientIp);
    }
    headers.set("x-forwarded-host", url.host);
    headers.set("x-forwarded-proto", url.protocol.replace(":", ""));

    const init = {
      method: request.method,
      headers,
      redirect: "manual",
    };

    if (request.method !== "GET" && request.method !== "HEAD") {
      init.body = request.body;
    }

    return fetch(upstream.toString(), init);
  },

  async scheduled(controller, env, ctx) {
    const origin = resolveOrigin(env);
    const cronSecret =
      typeof env?.CRON_SECRET === "string" ? env.CRON_SECRET.trim() : "";
    const revalidateSecret =
      typeof env?.REVALIDATE_SECRET === "string"
        ? env.REVALIDATE_SECRET.trim()
        : "";

    const task = (async () => {
      // The daily digest. Any trigger whose expression is in DIGEST_CRONS runs
      // it; every other trigger — the feed refresh — falls through unchanged.
      if (DIGEST_CRONS.has(controller?.cron)) {
        if (!cronSecret) {
          console.warn("[worker] digest trigger fired but CRON_SECRET is not set");
          return;
        }
        const res = await fetch(`${origin}/api/cron/digest`, {
          method: "GET",
          headers: { Authorization: `Bearer ${cronSecret}` },
        });
        // The body is a short JSON summary — sent, failed, anything skipped and
        // why — and is what makes a quiet failure visible in the Worker's logs.
        console.log(
          `[worker] GET /api/cron/digest -> ${res.status} ${(await res.text()).slice(0, 300)}`,
        );
        return;
      }

      if (cronSecret) {
        const res = await fetch(`${origin}/api/revalidate`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${cronSecret}`,
          },
        });
        console.log(`[worker] GET /api/revalidate -> ${res.status}`);
        return;
      }

      if (revalidateSecret) {
        const endpoint = new URL("/api/revalidate", origin);
        endpoint.searchParams.set("secret", revalidateSecret);
        const res = await fetch(endpoint.toString(), { method: "POST" });
        console.log(`[worker] POST /api/revalidate -> ${res.status}`);
        return;
      }

      console.warn(
        "[worker] scheduled trigger fired but neither CRON_SECRET nor REVALIDATE_SECRET is set",
      );
    })();

    if (ctx && typeof ctx.waitUntil === "function") {
      ctx.waitUntil(task);
    } else {
      await task;
    }
  },
};

export default worker;
