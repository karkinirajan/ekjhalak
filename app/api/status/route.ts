// app/api/status/route.ts
// System health endpoint — DB ping, last ingest run, translation queue depth.

import { NextResponse } from "next/server";
import sql from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const hasDb = Boolean(process.env.DATABASE_URL);
  const result: Record<string, unknown> = {
    ok: true,
    timestamp: new Date().toISOString(),
    db: hasDb ? "connecting" : "disabled",
  };

  if (!hasDb) {
    result.db = "disabled";
    result.mode = "in-memory";
    return NextResponse.json(result);
  }

  try {
    // Ping DB
    await sql`SELECT 1`;
    result.db = "ok";
  } catch (err) {
    result.db = "error";
    result.dbError = (err as Error).message;
    result.ok = false;
    return NextResponse.json(result, { status: 503 });
  }

  try {
    // Last ingest run
    const [run] = await sql<
      {
        triggeredAt: string;
        durationMs: number;
        articlesInserted: number;
        status: string;
      }[]
    >`
      SELECT triggered_at, duration_ms, articles_inserted, status
      FROM ingest_runs
      ORDER BY triggered_at DESC
      LIMIT 1
    `;
    result.lastIngest = run ?? null;
  } catch {
    result.lastIngest = null;
  }

  try {
    // Translation queue depth
    const [{ count }] = await sql<{ count: string }[]>`
      SELECT COUNT(*) AS count
      FROM translations
      WHERE status = 'pending'
    `;
    result.translationQueueDepth = parseInt(count, 10);
  } catch {
    result.translationQueueDepth = null;
  }

  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
