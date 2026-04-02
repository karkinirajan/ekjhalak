// lib/db.ts
// Database connection via postgres.js (server-only).
// Single, lazily-created connection pool shared across the process.
//
// We use postgres.js (the `postgres` npm package) directly — it typechecks
// against our schema types and gives us fine-grained control over the query
// layer without a heavy ORM.
//
// Connection string is DATABASE_URL (Supabase connection pooler URL).
// For local dev without Supabase, set DATABASE_URL to a local Postgres instance.

import postgres from "postgres";

declare global {
  var __pg: postgres.Sql | undefined;
}

function createClient(): postgres.Sql {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Please configure it in your .env file.\n" +
        "For Supabase: use the connection pooler URL (Transaction mode on port 6543).",
    );
  }

  return postgres(connectionString, {
    // Supabase pooler (Transaction mode) requires max 1 per serverless function.
    // For direct connections (Session mode / local dev), this can be higher.
    max: parseInt(process.env.DB_POOL_MAX ?? "1", 10),
    idle_timeout: 20,
    connect_timeout: 10,
    // Disable prepared statements for PgBouncer / Supabase Transaction pooler.
    prepare: false,
    // Transform snake_case column names to camelCase JS objects.
    transform: postgres.camel,
  });
}

// Singleton pool — dev hot-reload safe.
// Returns a no-op proxy when DATABASE_URL is absent so that modules that
// import sql don't crash at build time.  Any actual query will throw at
// runtime (the route handler checks process.env.DATABASE_URL first).
function getOrCreateClient(): postgres.Sql {
  if (!process.env.DATABASE_URL) {
    // Return a proxy that throws a clear error on the first tagged-template call
    const handler: ProxyHandler<object> = {
      get(_, prop) {
        if (prop === "then" || prop === "catch" || prop === "finally") {
          return undefined; // not a Promise — prevent accidental await of the proxy
        }
        // Return a function that throws a descriptive error
        return () => {
          throw new Error(
            "DATABASE_URL is not set. Cannot execute DB query.\n" +
              "For Supabase: use the connection pooler URL (Transaction mode on port 6543).",
          );
        };
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new Proxy({} as any, handler) as postgres.Sql;
  }

  if (process.env.NODE_ENV === "production") {
    return createClient();
  }
  return global.__pg ?? (global.__pg = createClient());
}

const sql: postgres.Sql = getOrCreateClient();

export default sql;
