// lib/cron-auth.ts
// Who may trigger a scheduled job.
//
// Two callers, two credentials, shared by every cron-style route:
//
//   GET   a scheduler. Vercel Cron and the Cloudflare Worker both send
//         `Authorization: Bearer $CRON_SECRET`, and a scheduler only ever issues
//         GET.
//
//   POST  anything else trusted — a systemd timer, a person with curl —
//         authenticated with `?secret=` against REVALIDATE_SECRET.
//
// Both fail closed. The first version of the revalidate route skipped the check
// entirely when its secret was unset — "allow freely (dev/staging)" — which
// meant a forgotten environment variable did not break the deploy, it published
// an unauthenticated endpoint. A missing secret in production is now a refusal;
// only an explicitly non-production NODE_ENV opens the door.

import { secretsMatch } from "./secret-compare";

export function isCronAuthorized(
  method: "GET" | "POST",
  presented: string | null,
): boolean {
  const expected =
    method === "GET" ? process.env.CRON_SECRET : process.env.REVALIDATE_SECRET;

  if (expected) return secretsMatch(presented, expected);

  // No secret configured: allowed only outside production, where there is
  // nothing to protect and requiring one would make local work tedious.
  return process.env.NODE_ENV !== "production";
}

/** The bearer token on a request, or null. */
export function bearerToken(headers: Headers): string | null {
  return headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
}
