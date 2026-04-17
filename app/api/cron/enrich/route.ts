// app/api/cron/enrich/route.ts
// Vercel Cron target for the translation enrichment queue.
// Invoked every 10 minutes (see vercel.json). Processes up to 2 pending
// translations per run — configured in lib/enrich/translate.ts.

import { NextRequest, NextResponse } from "next/server";
import { pumpTranslations } from "@/lib/enrich/translate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Allow up to 60s — Groq summarize + full translate for 2 items fits in this.
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  // Vercel Cron sends Authorization: Bearer <CRON_SECRET>.
  // In prod this header is set automatically when CRON_SECRET is configured.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { ok: false, reason: "Database not configured" },
      { status: 503 },
    );
  }

  try {
    const result = await pumpTranslations();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/enrich] error:", err);
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
