import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { maskEmail } from "@/lib/email-address";
import { UNSUBSCRIBE_COPY, type UnsubscribeStatus } from "@/lib/subscribe-copy";
import { verifyUnsubscribeToken } from "@/lib/subscribe-token";

export const metadata: Metadata = {
  title: "Unsubscribe",
  // Meaningful only to the one reader holding their own link.
  robots: { index: false, follow: false },
};

const RESULTS = new Set<UnsubscribeStatus>(["done", "invalid", "failed", "busy"]);

/**
 * Where the unsubscribe link in a digest lands.
 *
 * Opening it shows a button and changes nothing. The link is fetched by mail
 * scanners and previewers as well as by people, so acting on the fetch would
 * unsubscribe readers whose provider merely looked at their mail. The button
 * posts to /api/unsubscribe, which redirects back here with the outcome.
 *
 * A server component with no theme provider above it: the language comes from the
 * query string the digest put there, as on the confirmation page.
 */
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; status?: string; lang?: string }>;
}) {
  const params = await searchParams;
  const lang = params.lang === "np" ? "np" : "en";
  const isNp = lang === "np";

  // A finished outcome, redirected here by the API.
  let status: UnsubscribeStatus = RESULTS.has(params.status as UnsubscribeStatus)
    ? (params.status as UnsubscribeStatus)
    : "prompt";

  // Otherwise, a link a reader has just opened: show who they are leaving as.
  let maskedEmail: string | null = null;
  const token = params.token ?? "";
  if (status === "prompt") {
    const verified = token ? verifyUnsubscribeToken(token) : null;
    if (verified?.ok) maskedEmail = maskEmail(verified.email);
    else status = "invalid";
  }

  const copy = UNSUBSCRIBE_COPY[lang][status];
  const good = status === "done";
  const action = `/api/unsubscribe?token=${encodeURIComponent(token)}&lang=${lang}&then=page`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6 py-16">
      <div className="w-full max-w-md text-center">
        <p className="leading-none">
          <span
            className={`text-2xl font-semibold tracking-tight text-ink ${isNp ? "font-np" : "font-display"}`}
          >
            {isNp ? "एक झलक" : "EkJhalak"}
          </span>
        </p>

        <div
          aria-hidden="true"
          className={`mx-auto mt-8 h-1 w-14 rounded-md ${good ? "bg-support" : "bg-accent"}`}
        />

        <h1
          lang={isNp ? "ne" : "en"}
          className={`mt-8 text-[1.6rem] leading-[1.25] font-semibold tracking-[-0.02em] text-ink ${isNp ? "font-np leading-[1.45]" : "font-display"}`}
        >
          {copy.title}
        </h1>

        <p
          lang={isNp ? "ne" : "en"}
          // An outcome is announced; the question on the prompt is not news.
          role={status === "prompt" ? undefined : "status"}
          className={`copy mt-4 text-[1rem] leading-[1.75] text-ink-soft ${isNp ? "font-np leading-[1.9]" : ""}`}
        >
          {copy.body}
        </p>

        {status === "prompt" && maskedEmail ? (
          <>
            <p className="mt-3 text-[1rem] font-semibold text-ink" translate="no">
              {maskedEmail}
            </p>
            <form method="post" action={action} className="mt-8">
              <button
                type="submit"
                className={`inline-flex items-center rounded-md bg-accent-solid px-5 py-3 text-sm font-semibold text-on-accent transition-opacity hover:opacity-85 ${isNp ? "font-np" : ""}`}
              >
                {copy.button}
              </button>
            </form>
          </>
        ) : null}

        <Link
          href="/"
          className={`mt-9 inline-flex items-center gap-2 rounded-md ${
            status === "prompt"
              ? "px-5 py-3 text-sm font-semibold text-ink underline underline-offset-4"
              : "bg-ink px-5 py-3 text-sm font-semibold text-canvas transition-opacity hover:opacity-85"
          } ${isNp ? "font-np" : ""}`}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {copy.back}
        </Link>
      </div>
    </div>
  );
}
