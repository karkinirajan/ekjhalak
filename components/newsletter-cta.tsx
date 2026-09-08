"use client";

import { useState } from "react";
import { ArrowRight, Check, Loader2, Mail, MailCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useSite } from "@/components/site-provider";
import { checkEmail } from "@/lib/email-address";
import { cn } from "@/lib/utils";

type SubmitState =
  | "idle"
  | "sending"
  /** Confirmation link sent — the address is not on the list yet. */
  | "check-inbox"
  /** Subscribed outright, on deployments with no mail transport to confirm with. */
  | "done"
  | "invalid"
  | "throwaway"
  | "closed"
  | "busy"
  | "failed";

/**
 * Newsletter conversion band.
 *
 * A solid field bordered off from the canvas — the step furthest from the type
 * in either theme, so it is the blackest panel on Press Night and the whitest
 * on Press Day. It carries the only place on the page where both accent colours
 * appear at once, which is what marks it as an offer rather than an article.
 *
 * The success state only appears when the API confirms the address reached a
 * real provider. Without one configured the reader is told signups aren't open,
 * rather than being shown a confirmation nobody can act on.
 */
export function NewsletterCta() {
  const { t, language } = useSite();
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [state, setState] = useState<SubmitState>("idle");
  const isNp = language === "np";

  const message =
    state === "invalid"
      ? t.newsletterInvalid
      : state === "throwaway"
        ? t.newsletterThrowaway
        : state === "closed"
          ? t.newsletterUnavailable
          : state === "busy"
            ? t.newsletterBusy
            : state === "failed"
              ? t.newsletterFailed
              : null;

  const settled = state === "check-inbox" || state === "done";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const value = email.trim().toLowerCase();

    // Client-side validation is a courtesy, not a gate: the same check runs in
    // lib/email-address.ts on the server, which is the one that decides.
    const check = checkEmail(value);
    if (!check.ok) {
      setState(check.problem === "disposable" ? "throwaway" : "invalid");
      return;
    }

    setState("sending");
    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: check.email, lang: language, company }),
      });

      const body = await response.json().catch(() => null);

      if (response.ok) {
        // The server says which half of the flow it completed. A confirmation
        // link was sent, or — with no mail transport configured — the address
        // went straight onto the list. These are different promises and the
        // reader is told which one they got.
        setState(body?.status === "subscribed" ? "done" : "check-inbox");
        setEmail("");
      } else if (response.status === 429) {
        setState("busy");
      } else if (response.status === 503) {
        setState("closed");
      } else if (response.status === 400) {
        setState(body?.problem === "disposable" ? "throwaway" : "invalid");
      } else {
        setState("failed");
      }
    } catch {
      setState("failed");
    }
  }

  return (
    <section
      aria-label={t.newsletterTitle}
      className="relative isolate overflow-hidden rounded-sm border border-rule/20 bg-surface px-6 py-12 sm:px-10 sm:py-14"
    >
      {/* Ambient wash — red in one corner, green in the other. The only place
          the two accents meet, which is what marks this band as the offer. */}


      <div className="relative mx-auto max-w-2xl text-center">
        <span className="eyebrow inline-flex items-center gap-2 rounded-md border border-rule-strong bg-raised px-3 py-1.5 text-ink">
          <Mail className="h-3 w-3" aria-hidden="true" />
          {t.newsletterKicker}
        </span>

        <h2
          className={cn(
            "headline mt-5 text-[clamp(1.6rem,4.5vw,2.6rem)] font-bold tracking-tight text-ink",
            isNp ? "font-np leading-snug" : "font-display leading-[1.12]",
          )}
        >
          {t.newsletterTitle}
        </h2>

        <p
          className={cn(
            "copy mx-auto mt-4 max-w-lg text-[0.975rem] leading-relaxed text-ink-soft",
            isNp && "font-np",
          )}
        >
          {t.newsletterDesc}
        </p>

        {settled ? (
          <p
            role="status"
            className={cn(
              "mt-8 inline-flex items-start gap-2.5 rounded-md border border-support/40 bg-support-soft px-5 py-3 text-left text-sm font-medium text-ink",
              isNp && "font-np",
            )}
          >
            {state === "check-inbox" ? (
              <MailCheck
                className="mt-0.5 h-4 w-4 shrink-0 text-support"
                aria-hidden="true"
              />
            ) : (
              <Check
                className="mt-0.5 h-4 w-4 shrink-0 text-support"
                aria-hidden="true"
              />
            )}
            {state === "check-inbox"
              ? t.newsletterCheckInbox
              : t.newsletterSuccess}
          </p>
        ) : (
          // `noValidate` hands validation to this component rather than the
          // browser. `type="email"` still earns the right mobile keyboard, but
          // its native constraint was rejecting the submit before onSubmit ran,
          // so a typo produced Chrome's own bubble — untranslated, unstyled, and
          // in English no matter which language the reader chose. checkEmail()
          // runs here and again on the server, so nothing is lost by silencing
          // the browser's version.
          <form onSubmit={handleSubmit} noValidate className="relative mt-8">
            <div className="mx-auto flex max-w-md flex-col gap-2.5 sm:flex-row">
              <label htmlFor="newsletter-email" className="sr-only">
                {t.newsletterPlaceholder}
              </label>
              <Input
                id="newsletter-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (state !== "idle" && state !== "sending") setState("idle");
                }}
                placeholder={t.newsletterPlaceholder}
                aria-invalid={state === "invalid"}
                aria-describedby={message ? "newsletter-message" : undefined}
                className="h-12 flex-1 rounded-md border-rule-strong bg-surface px-5 text-base text-ink placeholder:text-ink-muted focus-visible:border-accent focus-visible:ring-accent/30"
              />
              <button
                type="submit"
                disabled={state === "sending"}
                className={cn(
                  "inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-md bg-accent-solid px-6 text-sm font-semibold text-white transition-transform hover:scale-[1.02] active:scale-100 disabled:opacity-60",
                  isNp && "font-np",
                )}
              >
                {state === "sending" ? t.newsletterSending : t.newsletterCta}
                {state === "sending" ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>

            {/* Honeypot. Hidden from people and from assistive tech, left empty
                by anyone filling this form by hand, and filled in by the sort of
                bot that completes every input it finds. `tabIndex={-1}` keeps it
                out of the keyboard path and `aria-hidden` keeps it out of the
                accessibility tree, so no real reader can reach it by accident.
                Positioned off-screen rather than `display:none`, which the
                cruder bots specifically check for. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -left-[9999px] h-px w-px overflow-hidden"
            >
              <label htmlFor="newsletter-company">Company</label>
              <input
                id="newsletter-company"
                name="company"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={company}
                onChange={(event) => setCompany(event.target.value)}
              />
            </div>

            {message && (
              <p
                id="newsletter-message"
                role="alert"
                className={cn("mt-3 text-sm text-accent", isNp && "font-np")}
              >
                {message}
              </p>
            )}

            <p
              className={cn(
                "eyebrow mt-4 text-ink-muted",
                isNp && "font-np tracking-normal",
              )}
            >
              {t.newsletterPrivacy}
            </p>
          </form>
        )}
      </div>
    </section>
  );
}
