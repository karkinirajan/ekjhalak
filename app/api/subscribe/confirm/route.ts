import { NextRequest, NextResponse } from "next/server";
import { addSubscriber } from "@/lib/newsletter";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { siteUrl } from "@/lib/site-url";
import { confirmSubscriber } from "@/lib/subscribers";
import { verifyConfirmationToken } from "@/lib/subscribe-token";

/**
 * The second half of double opt-in: the link in the confirmation email.
 *
 * A GET that changes state, which is normally the wrong shape — but a link in an
 * email can only ever be a GET, and the alternative is a landing page with a
 * button that posts, which costs the reader a second click to no benefit. The
 * signed token is what makes it safe: this endpoint cannot be usefully triggered
 * by anyone who does not already hold a link we minted.
 *
 * Always redirects to a page rather than returning JSON. Whoever reaches here
 * came from their inbox and is expecting a web page, including when the token
 * has expired — an error object rendered as raw text in a browser tab is not an
 * answer to somebody who just tried to subscribe.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const lang = searchParams.get("lang") === "np" ? "np" : "en";

  // Built from the configured site URL, not from request.url.
  //
  // Behind a reverse proxy request.url is what nginx forwarded —
  // http://localhost:3000 — so resolving against it sent every reader who
  // clicked a confirmation link to localhost. On Netlify request.url was the
  // public address and this was invisible; it appeared the moment the app moved
  // behind nginx. siteUrl() reads NEXT_PUBLIC_SITE_URL, which is the one place
  // that already knows what this site is called.
  const redirect = (status: string) =>
    NextResponse.redirect(
      new URL(
        `/subscribe/confirmed?status=${status}&lang=${lang}`,
        siteUrl() || request.url,
      ),
      // 303: the browser must follow with a GET, and the result must not be
      // cached as a permanent move — this URL means something different every
      // time it is called.
      303,
    );

  // Mail scanners and link-preview bots fetch every URL in a message, so this
  // endpoint is hit by things that are not the reader. The limiter keeps a
  // scanner that retries from turning into a run of provider calls.
  const limit = rateLimit(
    `confirm:${clientKey(request.headers)}`,
    20,
    10 * 60 * 1000,
  );
  if (!limit.allowed) return redirect("busy");

  const token = searchParams.get("token");
  if (!token) return redirect("invalid");

  const verified = verifyConfirmationToken(token);
  if (!verified.ok) {
    return redirect(verified.reason === "expired" ? "expired" : "invalid");
  }

  // The database is the list; Resend is a copy of it. Recorded first so a
  // provider outage cannot cost us a confirmation the reader actually made.
  const stored = await confirmSubscriber(verified.email);

  const added = await addSubscriber(verified.email);

  // Only a failure on both sides is a failure to the reader. If the row is
  // written, the person is subscribed whatever Resend thinks — the audience is
  // a mirror of this list and can be rebuilt from it.
  if (!added.ok && !stored.confirmed && !stored.alreadyConfirmed) {
    return redirect("failed");
  }

  const already = stored.alreadyConfirmed || (added.ok && added.alreadySubscribed);
  return redirect(already ? "already" : "confirmed");
}
