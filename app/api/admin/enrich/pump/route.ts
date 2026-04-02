// app/api/admin/enrich/pump/route.ts
// HMAC-protected endpoint to pump the translation enrichment queue.

import { NextRequest, NextResponse } from "next/server";
import { verifyHmac, extractSignatureFromRequest } from "@/lib/security/hmac";
import {
  rateLimit,
  ADMIN_LIMIT,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";
import { pumpTranslations } from "@/lib/enrich/translate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const rl = rateLimit(`admin-enrich:${ip}`, ADMIN_LIMIT);
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

  const rawBody = await req.text();
  const signature = extractSignatureFromRequest(req.headers);

  if (!signature || !verifyHmac(rawBody, signature, secret)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 },
    );
  }

  try {
    const result = await pumpTranslations();
    return NextResponse.json(
      { ok: true, ...result },
      { headers: rateLimitHeaders(rl) },
    );
  } catch (err) {
    console.error("[admin/enrich/pump] error:", err);
    return NextResponse.json(
      { error: "Pump failed", message: (err as Error).message },
      { status: 500, headers: rateLimitHeaders(rl) },
    );
  }
}
