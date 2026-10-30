// lib/digest-store.ts
// The digest's reads and its delivery ledger, in Postgres. Server-only.
//
// `digest_deliveries` has one row per subscriber per digest date, and it is what
// makes a cron safe to run more than once. A scheduler retries, fires twice, or
// is deliberately scheduled three times across the send window so that a run cut
// short by a time limit is finished by the next one — and none of that may mail
// anybody twice. So recipients are not read and then sent to; they are *claimed*,
// in one statement, and only the claimer sends.

import "server-only";

import { query } from "./db";
import { fromRow, STORY_SELECT, type StoredArticleRow } from "./article-rows";
import type { NewsItem } from "./news-pipeline";

const TIMEOUT_MS = 8_000;

/**
 * How long a claim holds before another run may take it over.
 *
 * A run that claimed rows and then died — the function was killed, the process
 * restarted — leaves them 'sending' forever unless something can reclaim them.
 * Fifteen minutes is far longer than a batch takes and short enough that the
 * next scheduled trigger in the same morning picks them up.
 */
const CLAIM_TTL_MINUTES = 15;

/**
 * Stories published in the last `hours`, best-covered first.
 *
 * Not yet filtered by the publish gate or cut to the digest's size — that is
 * lib/digest.ts and lib/publish-gate.ts, which are pure. The upper bound on
 * `published_at` drops stories a feed has dated in the future, which a
 * "last 24 hours" list should not contain.
 */
export async function fetchRecentStories(
  hours: number,
  limit: number,
): Promise<NewsItem[]> {
  const rows = await query<StoredArticleRow & Record<string, unknown>>(
    `SELECT ${STORY_SELECT.split(",").join(", ")}
       FROM articles
      WHERE published_at >= now() - make_interval(hours => $1::int)
        AND published_at <= now() + interval '1 hour'
      ORDER BY coverage_count DESC, published_at DESC
      LIMIT $2`,
    [hours, limit],
    TIMEOUT_MS,
  );
  return rows.map(fromRow);
}

export interface Recipient {
  id: string;
  email: string;
  language: string;
}

/**
 * Claim up to `limit` confirmed subscribers who have not yet had this date's
 * digest, and return them.
 *
 * One statement, so two overlapping runs cannot claim the same person: the
 * insert either wins the row or conflicts with whoever did. A conflicting row is
 * taken over only if its last attempt failed or its claim has gone stale, never
 * while another run is plausibly still sending it.
 *
 * `exclude` is everyone this run has already claimed. A failed row is claimable
 * by *a later run* — that is how a throttled morning gets finished — but not
 * again by the run that just failed it, or a single permanently rejected address
 * would be retried in a loop until the time budget ran out.
 */
export async function claimRecipients(
  date: string,
  limit: number,
  exclude: string[] = [],
): Promise<Recipient[]> {
  return query<Recipient & Record<string, unknown>>(
    `WITH claimed AS (
       INSERT INTO digest_deliveries (digest_date, subscriber_id, status, attempted_at)
       SELECT $1::date, s.id, 'sending', now()
         FROM subscribers s
        WHERE s.status = 'confirmed'
          AND s.id <> ALL($3::bigint[])
          AND NOT EXISTS (
                SELECT 1 FROM digest_deliveries d
                 WHERE d.digest_date = $1::date
                   AND d.subscriber_id = s.id
                   AND (d.status = 'sent'
                        OR (d.status = 'sending'
                            AND d.attempted_at > now() - make_interval(mins => ${CLAIM_TTL_MINUTES})))
              )
        ORDER BY s.id
        LIMIT $2
       ON CONFLICT (digest_date, subscriber_id) DO UPDATE
             SET status = 'sending', attempted_at = now(), error = NULL
           WHERE digest_deliveries.status = 'failed'
              OR (digest_deliveries.status = 'sending'
                  AND digest_deliveries.attempted_at <= now() - make_interval(mins => ${CLAIM_TTL_MINUTES}))
       RETURNING subscriber_id
     )
     SELECT s.id::text AS id, s.email, s.language
       FROM claimed c
       JOIN subscribers s ON s.id = c.subscriber_id
      ORDER BY s.id`,
    [date, limit, exclude],
    TIMEOUT_MS,
  );
}

/** Record how a claimed group of sends ended. */
export async function markDelivery(
  date: string,
  subscriberIds: string[],
  status: "sent" | "failed",
  error?: string,
): Promise<void> {
  if (subscriberIds.length === 0) return;
  await query(
    `UPDATE digest_deliveries
        SET status = $3, error = $4, attempted_at = now()
      WHERE digest_date = $1::date
        AND subscriber_id = ANY($2::bigint[])`,
    [date, subscriberIds, status, error ?? null],
    TIMEOUT_MS,
  );
}
