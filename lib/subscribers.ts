// lib/subscribers.ts
//
// The subscriber list, in Postgres.
//
// Before this existed the double opt-in was stateless: a signed link went out,
// the confirm route verified the signature, and nothing was written down. The
// signature proved the click came from the inbox that asked — which is the hard
// part — but nobody could answer "who is subscribed", because the answer lived
// only in whatever Resend happened to have.
//
// Two tables rather than one. `subscribers` says what is true now; the write is
// an upsert, so re-subscribing updates one row instead of creating a second.
// `subscription_events` is append-only and says what happened, which an UPDATE
// cannot: after a row flips to confirmed, the request that preceded it is gone
// unless something recorded it.
import "server-only";

import { isDbConfigured, query } from "./db";

/** Ceiling on one subscriber query. Short: a reader is waiting on it. */
const TIMEOUT_MS = 3_000;

export type SubscriberStatus =
  | "pending"
  | "confirmed"
  | "unsubscribed"
  | "bounced";

export interface SubscriberRecord {
  email: string;
  status: SubscriberStatus;
  language: string;
  confirmedAt: string | null;
}

/**
 * Addresses are stored lowercased.
 *
 * The local part of an address is case-sensitive by RFC, and in practice no
 * provider anyone here uses treats it that way. Storing as typed would let
 * Reader@example.com and reader@example.com become two rows, two confirmation
 * mails and two copies of every send — which is the user's problem, not theirs.
 */
const normalize = (email: string) => email.trim().toLowerCase();

/**
 * What the list already knows about this address.
 *
 * Returns null when the address is new, and also when there is no database at
 * all: a deployment without one still subscribes people, it just cannot
 * remember them. Callers treat null as "not known", which is the truth in both
 * cases.
 */
export async function findSubscriber(
  email: string,
): Promise<SubscriberRecord | null> {
  if (!isDbConfigured()) return null;

  try {
    const rows = await query<{
      email: string;
      status: SubscriberStatus;
      language: string;
      confirmed_at: Date | null;
    }>(
      `SELECT email, status, language, confirmed_at
         FROM subscribers WHERE email = $1 LIMIT 1`,
      [normalize(email)],
      TIMEOUT_MS,
    );

    const row = rows[0];
    if (!row) return null;
    return {
      email: row.email,
      status: row.status,
      language: row.language,
      confirmedAt: row.confirmed_at ? row.confirmed_at.toISOString() : null,
    };
  } catch (err) {
    console.warn("[subscribers] lookup failed:", message(err));
    return null;
  }
}

/**
 * Record that someone asked to subscribe.
 *
 * Called before the confirmation mail goes out, not after. If Resend fails you
 * still want to know somebody asked: a pending row with no confirmation is a
 * diagnosable state, and a silent nothing is not.
 *
 * A confirmed subscriber who asks again stays confirmed. The upsert deliberately
 * does not reset status, because the obvious spelling — set it to 'pending' on
 * every request — would let anyone who knows an address revoke that person's
 * subscription by typing it into the form.
 */
export async function recordRequest(
  email: string,
  language: string,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<void> {
  if (!isDbConfigured()) return;

  try {
    const rows = await query<{ id: string; status: SubscriberStatus }>(
      `INSERT INTO subscribers (email, language, status, source_ip, user_agent)
            VALUES ($1, $2, 'pending', $3, $4)
       ON CONFLICT (email) DO UPDATE
               SET language = EXCLUDED.language,
                   requested_at = now()
         RETURNING id, status`,
      [
        normalize(email),
        language === "np" ? "np" : "en",
        meta.ip ?? null,
        meta.userAgent?.slice(0, 500) ?? null,
      ],
      TIMEOUT_MS,
    );

    const row = rows[0];
    if (row) await logEvent(row.id, "requested", { language });
  } catch (err) {
    // A list that cannot be written is not a reason to refuse the subscription.
    // The mail still goes, the person still confirms; this one is lost.
    console.warn("[subscribers] request not recorded:", message(err));
  }
}

export interface ConfirmResult {
  /** True when this call is what moved the row to confirmed. */
  confirmed: boolean;
  /** True when it was already confirmed before this call. */
  alreadyConfirmed: boolean;
}

/**
 * Mark an address confirmed, once.
 *
 * Idempotent on purpose. People click the link twice, mail clients prefetch it,
 * and scanners follow every URL in a message — so the second call must change
 * nothing and must not look like a failure. `WHERE status <> 'confirmed'` is
 * what makes confirmed_at the moment of the first confirmation rather than the
 * most recent click.
 */
export async function confirmSubscriber(
  email: string,
): Promise<ConfirmResult> {
  if (!isDbConfigured()) return { confirmed: false, alreadyConfirmed: false };

  try {
    const updated = await query<{ id: string }>(
      `UPDATE subscribers
          SET status = 'confirmed',
              confirmed_at = now(),
              unsubscribed_at = NULL
        WHERE email = $1 AND status <> 'confirmed'
        RETURNING id`,
      [normalize(email)],
      TIMEOUT_MS,
    );

    const row = updated[0];
    if (row) {
      await logEvent(row.id, "confirmed", {});
      return { confirmed: true, alreadyConfirmed: false };
    }

    // Nothing updated: either already confirmed, or there is no row because the
    // request predates this table. The token's signature is proof enough that
    // the address asked, so insert it confirmed rather than lose the person.
    const existing = await findSubscriber(email);
    if (existing?.status === "confirmed") {
      return { confirmed: false, alreadyConfirmed: true };
    }

    const inserted = await query<{ id: string }>(
      `INSERT INTO subscribers (email, status, confirmed_at)
            VALUES ($1, 'confirmed', now())
       ON CONFLICT (email) DO UPDATE
               SET status = 'confirmed', confirmed_at = now()
         RETURNING id`,
      [normalize(email)],
      TIMEOUT_MS,
    );
    const row2 = inserted[0];
    if (row2) await logEvent(row2.id, "confirmed", { backfilled: true });
    return { confirmed: true, alreadyConfirmed: false };
  } catch (err) {
    console.warn("[subscribers] confirm not recorded:", message(err));
    return { confirmed: false, alreadyConfirmed: false };
  }
}

/**
 * Take an address off the list.
 *
 * `ok` means the address is not subscribed when this returns — whether this call
 * removed it, it had already gone, or it was never there. All three are the same
 * answer to the reader, and treating "already unsubscribed" as a failure would
 * show an error to somebody who did exactly the right thing twice. `ok: false`
 * is reserved for the one case where the list could not be written, which the
 * reader must be told about because the next digest will still arrive.
 */
export async function unsubscribeSubscriber(
  email: string,
): Promise<{ ok: boolean }> {
  if (!isDbConfigured()) return { ok: false };

  try {
    const updated = await query<{ id: string }>(
      `UPDATE subscribers
          SET status = 'unsubscribed',
              unsubscribed_at = now()
        WHERE email = $1 AND status <> 'unsubscribed'
        RETURNING id`,
      [normalize(email)],
      TIMEOUT_MS,
    );

    const row = updated[0];
    if (row) await logEvent(row.id, "unsubscribed", {});
    return { ok: true };
  } catch (err) {
    console.warn("[subscribers] unsubscribe not recorded:", message(err));
    return { ok: false };
  }
}

/** How many people are actually subscribed. The one honest number. */
export async function countConfirmed(): Promise<number | null> {
  if (!isDbConfigured()) return null;
  try {
    const rows = await query<{ n: string }>(
      "SELECT count(*)::text AS n FROM subscribers WHERE status = 'confirmed'",
      [],
      TIMEOUT_MS,
    );
    const n = rows[0]?.n;
    return n === undefined ? null : Number(n);
  } catch {
    return null;
  }
}

async function logEvent(
  subscriberId: string,
  event: "requested" | "confirmed" | "unsubscribed" | "bounced" | "resent",
  detail: Record<string, unknown>,
): Promise<void> {
  try {
    await query(
      `INSERT INTO subscription_events (subscriber_id, event, detail)
            VALUES ($1, $2, $3)`,
      [subscriberId, event, JSON.stringify(detail)],
      TIMEOUT_MS,
    );
  } catch (err) {
    // The log is evidence, not state. Losing an entry must never fail the
    // subscription it was describing.
    console.warn("[subscribers] event not logged:", message(err));
  }
}

const message = (err: unknown) =>
  err instanceof Error ? err.message : String(err);
