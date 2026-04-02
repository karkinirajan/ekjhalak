// app/api/admin/ingest/run/route.ts
// HMAC-protected endpoint to trigger a manual ingest run.
// Sign requests with: HMAC-SHA256(body, INGEST_HMAC_SECRET)
// Header: X-Hub-Signature-256: sha256=<hex>

import { NextRequest, NextResponse } from "next/server";
import { verifyHmac, extractSignatureFromRequest } from "@/lib/security/hmac";
import {
  rateLimit,
  ADMIN_LIMIT,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";
import { runIngest } from "@/lib/ingest/run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // Rate limiting
  const ip = getClientIp(req.headers);
  const rl = rateLimit(`admin-ingest:${ip}`, ADMIN_LIMIT);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  const secret = process.env.INGEST_HMAC_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Admin endpoint not configured" },
      { status: 501 },
    );
  }

  // Read raw body for signature verification
  const rawBody = await req.text();
  const signature = extractSignatureFromRequest(req.headers);

  if (!signature || !verifyHmac(rawBody, signature, secret)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await runIngest("manual");
    return NextResponse.json(
      { ok: true, ...result },
      { headers: rateLimitHeaders(rl) },
    );
  } catch (err) {
    console.error("[admin/ingest/run] error:", err);
    return NextResponse.json(
      { error: "Ingest failed", message: (err as Error).message },
      { status: 500, headers: rateLimitHeaders(rl) },
    );
  }
}
