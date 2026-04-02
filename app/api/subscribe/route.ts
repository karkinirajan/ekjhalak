// app/api/subscribe/route.ts
// Newsletter subscription endpoint.
// Rate-limited to 5 requests per 10 minutes per IP.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import sql from "@/lib/db";
import {
  rateLimit,
  SUBSCRIBE_LIMIT,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  email: z
    .string()
    .email("Invalid email address")
    .max(254, "Email too long")
    .toLowerCase()
    .trim(),
  lang: z.enum(["en", "np"]).optional().default("en"),
});

export async function POST(req: NextRequest) {
  // Rate limiting
  const ip = getClientIp(req.headers);
  const rl = rateLimit(ip, SUBSCRIBE_LIMIT);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  // Parse body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422, headers: rateLimitHeaders(rl) },
    );
  }

  const { email, lang } = parsed.data;

  if (!process.env.DATABASE_URL) {
    // Graceful degradation — accept the email but note it wasn't saved
    console.warn(
      "[subscribe] No DATABASE_URL — subscription not persisted:",
      email,
    );
    return NextResponse.json(
      { ok: true, message: "Subscribed (demo mode — not persisted)" },
      { status: 200, headers: rateLimitHeaders(rl) },
    );
  }

  try {
    await sql`
      INSERT INTO subscribers (email, lang, status)
      VALUES (${email}, ${lang}, 'active')
      ON CONFLICT (email) DO UPDATE SET
        lang      = EXCLUDED.lang,
        status    = 'active',
        updated_at = NOW()
    `;
    return NextResponse.json(
      { ok: true, message: "Successfully subscribed" },
      { status: 200, headers: rateLimitHeaders(rl) },
    );
  } catch (err) {
    console.error("[subscribe] DB error:", err);
    return NextResponse.json(
      { error: "Subscription failed. Please try again." },
      { status: 500, headers: rateLimitHeaders(rl) },
    );
  }
}
