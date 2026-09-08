import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CONFIRM_COPY, type ConfirmStatus } from "@/lib/subscribe-copy";

export const metadata: Metadata = {
  title: "Subscription",
  // Nothing here belongs in an index: the page only means anything to the one
  // reader who arrived from their own confirmation link.
  robots: { index: false, follow: false },
};

const STATUSES = new Set<ConfirmStatus>([
  "confirmed",
  "already",
  "expired",
  "invalid",
  "failed",
  "busy",
]);

/**
 * Where the confirmation link lands.
 *
 * A server component with no theme provider above it, so it reads its language
 * from the query string that the confirm route passed through rather than from
 * the client-side toggle — the reader is arriving cold from an email client and
 * there is no React state to consult yet. The colour theme still comes from the
 * head script, which runs on every page.
 */
export default async function SubscribeConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; lang?: string }>;
}) {
  const params = await searchParams;
  const status: ConfirmStatus = STATUSES.has(params.status as ConfirmStatus)
    ? (params.status as ConfirmStatus)
    : "invalid";
  const lang = params.lang === "np" ? "np" : "en";
  const copy = CONFIRM_COPY[lang][status];
  const isNp = lang === "np";
  const good = status === "confirmed" || status === "already";

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
          role="status"
          className={`copy mt-4 text-[1rem] leading-[1.75] text-ink-soft ${isNp ? "font-np leading-[1.9]" : ""}`}
        >
          {copy.body}
        </p>

        <Link
          href="/"
          className={`mt-9 inline-flex items-center gap-2 rounded-md bg-ink px-5 py-3 text-sm font-semibold text-canvas transition-opacity hover:opacity-85 ${isNp ? "font-np" : ""}`}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {copy.back}
        </Link>
      </div>
    </div>
  );
}
