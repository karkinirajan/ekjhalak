import { NextRequest, NextResponse } from "next/server";

/**
 * Newsletter signup.
 *
 * There is no mailing list infrastructure in this repo, so rather than show a
 * confirmation the site cannot honour, this route forwards to whatever provider
 * is configured via NEWSLETTER_WEBHOOK_URL (Buttondown, ConvertKit, Formspree,
 * a Zapier hook — anything that accepts `{ email }` as JSON).
 *
 * With no provider configured it returns 503 and the form tells the reader
 * signups aren't open yet, which is true. It never claims a subscription that
 * was not actually recorded somewhere.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(request: NextRequest) {
  let email: unknown;

  try {
    ({ email } = await request.json());
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (typeof email !== "string" || !EMAIL_PATTERN.test(email.trim())) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  const endpoint = process.env.NEWSLETTER_WEBHOOK_URL;
  if (!endpoint) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  try {
    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.NEWSLETTER_API_KEY
          ? { Authorization: `Bearer ${process.env.NEWSLETTER_API_KEY}` }
          : {}),
      },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
      signal: AbortSignal.timeout(8000),
    });

    if (!upstream.ok) {
      console.error("[api/subscribe] provider rejected:", upstream.status);
      return NextResponse.json({ error: "provider_error" }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/subscribe] request failed:", err);
    return NextResponse.json({ error: "provider_error" }, { status: 502 });
  }
}
