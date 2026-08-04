import { NextRequest, NextResponse } from "next/server";
import { checkEmail } from "@/lib/email-address";
import {
  addSubscriber,
  canSendMail,
  isNewsletterConfigured,
  sendConfirmation,
} from "@/lib/newsletter";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import {
  createConfirmationToken,
  isTokenSigningConfigured,
} from "@/lib/subscribe-token";

/**
 * Newsletter signup — the first half of a double opt-in.
 *
 * Nothing is added to the list here. A signed confirmation link is emailed to
 * the address, and only clicking it subscribes anyone. That is what stops the
 * form being a way to sign up somebody else's inbox, and it is what makes the
 * consent claim on /privacy true rather than aspirational.
 *
 * Where confirmation mail cannot be sent — a deployment using the generic
 * webhook rather than Resend, which is a list endpoint and not a mail transport
 * — it falls back to single opt-in and says so in the response, rather than
 * silently doing something weaker than the privacy page describes.
 */

/**
 * Two limits, because there are two costs here and they are not the same.
 *
 * A malformed submission costs a JSON parse. A valid one costs an outbound email
 * and a provider call, and is the thing worth abusing. Metering both against one
 * counter meant a reader who mistyped their address five times was locked out
 * for ten minutes — punishing the clumsy to deter the malicious.
 *
 * So the burst limit is wide and guards the endpoint against flooding, while the
 * send limit is tight and guards the mailbox. Only submissions that get as far
 * as sending something consume the tight one.
 */
const BURST_LIMIT = 30;
const SEND_LIMIT = 5;
const RATE_WINDOW_MS = 10 * 60 * 1000;

function siteUrl(request: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  return request.nextUrl.origin;
}

function tooMany(retryAfter: number) {
  return NextResponse.json(
    { error: "rate_limited" },
    { status: 429, headers: { "retry-after": String(retryAfter) } },
  );
}

export async function POST(request: NextRequest) {
  const client = clientKey(request.headers);

  // Flood guard, checked before anything is parsed so a burst costs a header
  // read rather than a provider round-trip.
  const burst = rateLimit(`subscribe:burst:${client}`, BURST_LIMIT, RATE_WINDOW_MS);
  if (!burst.allowed) return tooMany(burst.retryAfter);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const payload = (body ?? {}) as {
    email?: unknown;
    lang?: unknown;
    company?: unknown;
  };

  // Honeypot. The field is present in the form, hidden from people and from
  // assistive tech, and left empty by anyone who is not filling the page in
  // programmatically. A bot that completes every input completes this one too.
  // Answered 200 rather than 400 so the bot has nothing to tune against.
  if (typeof payload.company === "string" && payload.company.trim() !== "") {
    return NextResponse.json({ ok: true, status: "confirm_sent" });
  }

  const checked = checkEmail(payload.email);
  if (!checked.ok) {
    return NextResponse.json(
      { error: "invalid_email", problem: checked.problem },
      { status: 400 },
    );
  }

  const lang = payload.lang === "np" ? "np" : "en";

  if (!isNewsletterConfigured()) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  // Past here the request costs an email and a provider call, so it draws on
  // the tight budget. A mistyped address never reaches this line.
  const send = rateLimit(`subscribe:send:${client}`, SEND_LIMIT, RATE_WINDOW_MS);
  if (!send.allowed) return tooMany(send.retryAfter);

  // ── Single opt-in path ────────────────────────────────────────────────────
  // No mail transport, or no signing key to build a tamper-proof link with.
  // Subscribing directly is weaker, and the response says which happened so the
  // UI can word the confirmation accurately.
  if (!canSendMail() || !isTokenSigningConfigured()) {
    const added = await addSubscriber(checked.email);
    if (!added.ok) {
      return NextResponse.json(
        { error: added.reason === "not-configured" ? "not_configured" : "provider_error" },
        { status: added.reason === "not-configured" ? 503 : 502 },
      );
    }
    return NextResponse.json({ ok: true, status: "subscribed" });
  }

  // ── Double opt-in ─────────────────────────────────────────────────────────
  const token = createConfirmationToken(checked.email);
  if (!token) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const confirmUrl = `${siteUrl(request)}/api/subscribe/confirm?token=${encodeURIComponent(token)}&lang=${lang}`;
  const sent = await sendConfirmation(checked.email, confirmUrl, lang);
  if (!sent.ok) {
    return NextResponse.json({ error: "provider_error" }, { status: 502 });
  }

  return NextResponse.json({ ok: true, status: "confirm_sent" });
}
