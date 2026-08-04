// lib/newsletter.ts
// Where a confirmed subscriber actually goes, and how the confirmation mail is
// sent. Server-only.
//
// Two providers behind one interface:
//
//   resend   the Vercel Marketplace integration. Its Audiences API *is* the
//            mailing list, so there is no separate database to run.
//   webhook  anything that accepts { email } as JSON — Buttondown, ConvertKit,
//            Formspree, a Zapier hook. Kept because it is what the site shipped
//            with and it costs nothing to keep working.
//
// When neither is configured every call reports `not-configured`, which the form
// surfaces as "signups aren't open yet". That is the honest answer: the address
// was not recorded anywhere, and telling the reader it was would be a lie the
// site could not act on.

const RESEND_API = "https://api.resend.com";
const REQUEST_TIMEOUT_MS = 10_000;

/** The list a confirmed reader is added to. Created on first use if absent. */
const AUDIENCE_NAME = "EkJhalak Daily Brief";

export type DeliveryOutcome =
  | { ok: true; alreadySubscribed?: boolean }
  | { ok: false; reason: "not-configured" | "provider-error" };

function resendKey(): string | undefined {
  return process.env.RESEND_API_KEY;
}

function webhookUrl(): string | undefined {
  return process.env.NEWSLETTER_WEBHOOK_URL;
}

export function isNewsletterConfigured(): boolean {
  return Boolean(resendKey() || webhookUrl());
}

/**
 * The From address.
 *
 * Must be on a domain verified in Resend or the send is rejected. Defaults to
 * the site's own domain rather than something generic, because a briefing that
 * arrives from a stranger's address is a briefing that lands in spam.
 */
function fromAddress(): string {
  return (
    process.env.NEWSLETTER_FROM ?? "EkJhalak <brief@ekjhalak.news>"
  );
}

async function resendFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response | null> {
  const key = resendKey();
  if (!key) return null;
  try {
    return await fetch(`${RESEND_API}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
        ...(init.headers ?? {}),
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    return null;
  }
}

// ── Audience ────────────────────────────────────────────────────────────────
//
// Resolved once per process and remembered. Resolving it on demand rather than
// requiring RESEND_AUDIENCE_ID in the environment removes a manual dashboard
// step from setup — the integration hands over an API key and nothing else, and
// an id copied by hand is an id that eventually gets copied wrong.

let cachedAudienceId: string | null = null;

async function ensureAudienceId(): Promise<string | null> {
  if (cachedAudienceId) return cachedAudienceId;

  const configured = process.env.RESEND_AUDIENCE_ID;
  if (configured) {
    cachedAudienceId = configured;
    return configured;
  }

  const listed = await resendFetch("/audiences");
  if (listed?.ok) {
    const body = await listed.json().catch(() => null);
    const found = (body?.data as Array<{ id: string; name: string }> | undefined)
      ?.find((audience) => audience.name === AUDIENCE_NAME);
    if (found?.id) {
      cachedAudienceId = found.id;
      return found.id;
    }
  }

  const created = await resendFetch("/audiences", {
    method: "POST",
    body: JSON.stringify({ name: AUDIENCE_NAME }),
  });
  if (created?.ok) {
    const body = await created.json().catch(() => null);
    if (typeof body?.id === "string") {
      cachedAudienceId = body.id;
      return body.id;
    }
  }

  return null;
}

// ── Confirmation mail ───────────────────────────────────────────────────────

interface ConfirmationCopy {
  subject: string;
  heading: string;
  body: string;
  cta: string;
  ignore: string;
}

const CONFIRMATION_COPY: Record<"en" | "np", ConfirmationCopy> = {
  en: {
    subject: "Confirm your EkJhalak briefing",
    heading: "One more step",
    body: "Tap the button below to start receiving the EkJhalak daily brief — Nepal and the world, in one short email each morning.",
    cta: "Confirm subscription",
    ignore:
      "If you did not ask for this, ignore this email. Nothing has been subscribed and the link expires in two days.",
  },
  np: {
    subject: "एक झलक ब्रिफिङ पुष्टि गर्नुहोस्",
    heading: "एउटा कदम बाँकी",
    body: "एक झलकको दैनिक ब्रिफिङ — नेपाल र विश्व, हरेक बिहान एउटै छोटो इमेलमा — प्राप्त गर्न तलको बटन थिच्नुहोस्।",
    cta: "सदस्यता पुष्टि गर्नुहोस्",
    ignore:
      "तपाईंले यो अनुरोध गर्नुभएको होइन भने यो इमेल बेवास्ता गर्नुहोस्। कुनै सदस्यता दर्ता भएको छैन र लिंक दुई दिनमा निष्क्रिय हुन्छ।",
  },
};

/**
 * Inline styles and a table-free layout on purpose.
 *
 * Email clients strip <style> blocks, ignore most of the cascade, and Gmail in
 * particular drops anything it does not recognise, so every rule that has to
 * survive is set on the element itself. Plain text ships alongside it because a
 * confirmation nobody can read is a subscription nobody completes.
 */
function confirmationHtml(url: string, copy: ConfirmationCopy): string {
  const escape = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  return `<!doctype html>
<html><body style="margin:0;padding:32px 16px;background:#fdfcf9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#111111;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e5e5e5;border-radius:6px;padding:32px;">
    <p style="margin:0 0 24px;font-size:20px;font-weight:700;letter-spacing:-0.02em;">EkJhalak <span style="color:#dc2626;">एक झलक</span></p>
    <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;font-weight:600;">${escape(copy.heading)}</h1>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#525252;">${escape(copy.body)}</p>
    <a href="${escape(url)}" style="display:inline-block;background:#dc2626;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 24px;border-radius:6px;">${escape(copy.cta)}</a>
    <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#737373;">${escape(copy.ignore)}</p>
    <p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#737373;word-break:break-all;">${escape(url)}</p>
  </div>
</body></html>`;
}

function confirmationText(url: string, copy: ConfirmationCopy): string {
  return `${copy.heading}\n\n${copy.body}\n\n${copy.cta}: ${url}\n\n${copy.ignore}`;
}

/**
 * Send the confirmation link.
 *
 * Only Resend can do this — a generic webhook is a list endpoint, not a mail
 * transport, so deployments using one skip confirmation and subscribe directly.
 * That is stated rather than hidden: `sendConfirmation` reporting
 * `not-configured` is what tells the route to fall back to single opt-in.
 */
export async function sendConfirmation(
  email: string,
  confirmUrl: string,
  lang: "en" | "np",
): Promise<DeliveryOutcome> {
  if (!resendKey()) return { ok: false, reason: "not-configured" };

  const copy = CONFIRMATION_COPY[lang];
  const res = await resendFetch("/emails", {
    method: "POST",
    body: JSON.stringify({
      from: fromAddress(),
      to: [email],
      subject: copy.subject,
      html: confirmationHtml(confirmUrl, copy),
      text: confirmationText(confirmUrl, copy),
    }),
  });

  if (!res) return { ok: false, reason: "provider-error" };
  if (!res.ok) {
    console.error(
      `[newsletter] Resend rejected the confirmation send: ${res.status} ${await res
        .text()
        .catch(() => "")}`.slice(0, 300),
    );
    return { ok: false, reason: "provider-error" };
  }
  return { ok: true };
}

// ── Subscribe ───────────────────────────────────────────────────────────────

/**
 * Record a confirmed address.
 *
 * Resend first, then the generic webhook. A 409 from Resend means the contact is
 * already on the list, which is a success from the reader's point of view —
 * re-confirming an existing subscription should say "you're on the list", not
 * throw an error at somebody who did nothing wrong.
 */
export async function addSubscriber(email: string): Promise<DeliveryOutcome> {
  if (resendKey()) {
    const audienceId = await ensureAudienceId();
    if (!audienceId) return { ok: false, reason: "provider-error" };

    const res = await resendFetch(`/audiences/${audienceId}/contacts`, {
      method: "POST",
      body: JSON.stringify({ email, unsubscribed: false }),
    });

    if (!res) return { ok: false, reason: "provider-error" };
    if (res.ok) return { ok: true };
    if (res.status === 409) return { ok: true, alreadySubscribed: true };

    console.error(
      `[newsletter] Resend rejected the contact: ${res.status} ${await res
        .text()
        .catch(() => "")}`.slice(0, 300),
    );
    return { ok: false, reason: "provider-error" };
  }

  const endpoint = webhookUrl();
  if (!endpoint) return { ok: false, reason: "not-configured" };

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.NEWSLETTER_API_KEY
          ? { authorization: `Bearer ${process.env.NEWSLETTER_API_KEY}` }
          : {}),
      },
      body: JSON.stringify({ email }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(`[newsletter] webhook rejected: ${res.status}`);
      return { ok: false, reason: "provider-error" };
    }
    return { ok: true };
  } catch (err) {
    console.error("[newsletter] webhook request failed:", err);
    return { ok: false, reason: "provider-error" };
  }
}

/** True when confirmation mail can actually be sent. */
export function canSendMail(): boolean {
  return Boolean(resendKey());
}
