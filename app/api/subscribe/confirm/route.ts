import { NextRequest, NextResponse } from "next/server";
import { addSubscriber } from "@/lib/newsletter";
import { clientKey, rateLimit } from "@/lib/rate-limit";
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

  const redirect = (status: string) =>
    NextResponse.redirect(
      new URL(`/subscribe/confirmed?status=${status}&lang=${lang}`, request.url),
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

  const added = await addSubscriber(verified.email);
  if (!added.ok) return redirect("failed");

  return redirect(added.alreadySubscribed ? "already" : "confirmed");
}
