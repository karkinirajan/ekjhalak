import { NextRequest, NextResponse } from "next/server";
import { unsubscribeContact } from "@/lib/newsletter";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { unsubscribeSubscriber } from "@/lib/subscribers";
import { verifyUnsubscribeToken } from "@/lib/subscribe-token";

/**
 * Leave the list.
 *
 * Two callers reach this URL, and they need opposite things:
 *
 *   POST  from the mail client's own "unsubscribe" button (RFC 8058 one-click —
 *         the `List-Unsubscribe-Post` header on every digest), or from the form
 *         on /unsubscribe. The only request that changes anything.
 *
 *   GET   a person opening the link from the header by hand. Redirected to the
 *         confirmation page and nothing else.
 *
 * A GET must not unsubscribe. Mail scanners and link-preview bots fetch every URL
 * in a message, so a link that acted on GET would remove readers the moment their
 * mail provider looked at it — which is the opposite of the confirmation route,
 * where a stray fetch of the link is harmless because it can only ever subscribe
 * somebody who asked to be.
 *
 * `?then=page` marks a request from our own form, which wants a web page back.
 * A one-click POST comes from a machine and gets JSON.
 */

const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 20;

/**
 * A 303 to a path on whichever host the reader is already on.
 *
 * Relative on purpose. `NextResponse.redirect` insists on an absolute URL, and the
 * only absolute one available here is the configured site URL — which is wrong
 * whenever the page is served from any other hostname (a preview deploy, the
 * Worker's own address, an apex/www mix), and which the browser refuses to follow
 * after a form POST anyway: the site's CSP says `form-action 'self'`, and that
 * applies to the redirect target. A relative `Location` is resolved by the
 * browser against the address it actually used, so it is always same-origin and
 * cannot be wrong behind a proxy.
 */
function seeOther(path: string): NextResponse {
  return new NextResponse(null, { status: 303, headers: { location: path } });
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const lang = searchParams.get("lang") === "np" ? "np" : "en";
  const token = searchParams.get("token") ?? "";
  return seeOther(`/unsubscribe?token=${encodeURIComponent(token)}&lang=${lang}`);
}

export async function POST(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const lang = searchParams.get("lang") === "np" ? "np" : "en";
  const fromPage = searchParams.get("then") === "page";

  const finish = (status: "done" | "invalid" | "failed" | "busy", code: number) =>
    fromPage
      ? seeOther(`/unsubscribe?status=${status}&lang=${lang}`)
      : NextResponse.json({ ok: status === "done", status }, { status: code });

  const limit = rateLimit(`unsubscribe:${clientKey(request.headers)}`, LIMIT, WINDOW_MS);
  if (!limit.allowed) return finish("busy", 429);

  const token = searchParams.get("token");
  if (!token) return finish("invalid", 400);

  const verified = verifyUnsubscribeToken(token);
  if (!verified.ok) return finish("invalid", 400);

  const result = await unsubscribeSubscriber(verified.email);
  if (!result.ok) return finish("failed", 500);

  // After the database, and awaited: the list is already right, and a serverless
  // function may be frozen the moment the response goes out, so a fire-and-forget
  // call here would often never run.
  await unsubscribeContact(verified.email).catch(() => undefined);

  return finish("done", 200);
}
