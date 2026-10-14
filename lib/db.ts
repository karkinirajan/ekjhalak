// lib/db.ts
//
// One connection pool, for the whole process.
//
// Server-only: importing this from a client component is a build error rather
// than a connection string in someone's browser.
import "server-only";

import { Pool } from "pg";

import { envString } from "./env";

/**
 * The pool is a module singleton because a pool per call is not a pool.
 *
 * Next.js re-evaluates modules on reload in development, so the instance is
 * parked on globalThis — without that, every edit leaks a pool and Postgres
 * runs out of connections long before anyone notices why.
 */
const globalForDb = globalThis as unknown as { ekjhalakPool?: Pool };

/**
 * Small on purpose.
 *
 * The box this runs on has under a gigabyte of RAM and Postgres wants its own
 * buffers out of it. The pipeline is one process doing batched writes, not a
 * fleet serving concurrent queries, so eight connections is already more
 * parallelism than it can use — and each idle one costs memory the pass needs.
 */
const MAX_CONNECTIONS = 8;

/**
 * Is this connection string pointed at the same machine?
 *
 * Parsed rather than pattern-matched against the whole string, because a
 * password or a database name containing the word "localhost" would otherwise
 * decide this — and deciding it wrongly means TLS silently off against a remote
 * host.
 */
function isLocal(connectionString: string): boolean {
  try {
    const host = new URL(connectionString).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "";
  } catch {
    // A socket path ("/var/run/postgresql") is not a URL and is always local.
    return connectionString.startsWith("/");
  }
}

export function pool(): Pool | null {
  const connectionString = envString("DATABASE_URL");
  if (!connectionString) return null;

  if (!globalForDb.ekjhalakPool) {
    globalForDb.ekjhalakPool = new Pool({
      connectionString,
      max: MAX_CONNECTIONS,
      idleTimeoutMillis: 30_000,
      // A connection that will not establish in five seconds is not going to
      // rescue a pass that has forty-five to finish in.
      connectionTimeoutMillis: 5_000,
      // Localhost needs no TLS — the traffic never leaves the box — and asking
      // for it there fails the connection outright. Anywhere else gets TLS with
      // verification left ON. The usual shortcut is `rejectUnauthorized: false`,
      // which does not "enable TLS": it accepts any certificate presented,
      // including an attacker's, so it buys encryption against a passive
      // listener and nothing at all against an active one. A managed provider
      // with a private CA should have its CA added here rather than have
      // verification turned off for every host.
      ssl: isLocal(connectionString) ? undefined : true,
    });

    // An idle client that errors — the server restarted, the network dropped —
    // emits on the pool. Unhandled, that is an uncaught exception that takes
    // the process down; the pool replaces the client on its own.
    globalForDb.ekjhalakPool.on("error", (err) => {
      console.warn("[db] idle client error:", err.message);
    });
  }

  return globalForDb.ekjhalakPool;
}

export function isDbConfigured(): boolean {
  return Boolean(envString("DATABASE_URL"));
}

/**
 * Run a query under a deadline.
 *
 * Every caller in this codebase is inside a pass with a fixed budget, so the
 * timeout is the caller's remaining time rather than a constant. The statement
 * timeout is set on the connection as well as raced in JavaScript: without it,
 * aborting here leaves the query running on the server, still holding locks and
 * still costing the box the work nobody is waiting for any more.
 */
export async function query<T extends Record<string, unknown>>(
  text: string,
  params: unknown[],
  timeoutMs: number,
): Promise<T[]> {
  const p = pool();
  if (!p) throw new Error("DATABASE_URL is not set");
  if (timeoutMs <= 0) throw new Error("no time left for the query");

  const client = await p.connect();
  try {
    await client.query(`SET LOCAL statement_timeout = ${Math.floor(timeoutMs)}`);
    const result = await client.query(text, params);
    return result.rows as T[];
  } finally {
    client.release();
  }
}
