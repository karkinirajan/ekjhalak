"use client";

import { useState } from "react";
import { ArrowRight, Check, Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

type SubmitState = "idle" | "sending" | "done" | "invalid" | "closed" | "failed";

/**
 * Newsletter conversion band.
 *
 * A solid black field bordered off from the canvas, carrying the only place on
 * the page where both accent colours appear at once — so it reads as an offer
 * rather than as another article.
 *
 * The success state only appears when the API confirms the address reached a
 * real provider. Without one configured the reader is told signups aren't open,
 * rather than being shown a confirmation nobody can act on.
 */
export function NewsletterCta() {
  const { t, language } = useTheme();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<SubmitState>("idle");
  const isNp = language === "np";

  const message =
    state === "invalid"
      ? t.newsletterInvalid
      : state === "closed"
        ? t.newsletterUnavailable
        : state === "failed"
          ? t.newsletterFailed
          : null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const value = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
      setState("invalid");
      return;
    }

    setState("sending");
    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value }),
      });

      if (response.ok) {
        setState("done");
        setEmail("");
      } else if (response.status === 503) {
        setState("closed");
      } else if (response.status === 400) {
        setState("invalid");
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
      className="relative isolate overflow-hidden rounded-lg border border-rule-strong bg-pitch px-6 py-12 sm:px-12 sm:py-16"
    >
      {/* Ambient wash — red in one corner, green in the other. The only place
          the two accents meet, which is what marks this band as the offer. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 70% 90% at 8% 0%, rgb(229 72 77 / 0.30), transparent 62%), radial-gradient(ellipse 60% 80% at 96% 100%, rgb(63 185 80 / 0.18), transparent 60%)",
        }}
      />

      <div className="relative mx-auto max-w-2xl text-center">
        <span className="eyebrow inline-flex items-center gap-2 rounded-full border border-rule-strong bg-raised px-3 py-1.5 text-ink">
          <Mail className="h-3 w-3" aria-hidden="true" />
          {t.newsletterKicker}
        </span>

        <h2
          className={cn(
            "headline mt-5 text-[clamp(1.6rem,4.5vw,2.6rem)] font-bold tracking-tight text-white",
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

        {state === "done" ? (
          <p
            role="status"
            className={cn(
              "mt-8 inline-flex items-center gap-2.5 rounded-full border border-green/40 bg-green-soft px-5 py-3 text-sm font-medium text-ink",
              isNp && "font-np",
            )}
          >
            <Check className="h-4 w-4 text-green" aria-hidden="true" />
            {t.newsletterSuccess}
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8">
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
                className="h-12 flex-1 rounded-full border-rule-strong bg-surface px-5 text-base text-ink placeholder:text-ink-muted focus-visible:border-red focus-visible:ring-red/30"
              />
              <button
                type="submit"
                disabled={state === "sending"}
                className={cn(
                  "inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-red px-6 text-sm font-semibold text-white transition-transform hover:scale-[1.02] active:scale-100 disabled:opacity-60",
                  isNp && "font-np",
                )}
              >
                {t.newsletterCta}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {message && (
              <p
                id="newsletter-message"
                role="alert"
                className={cn(
                  "mt-3 text-sm text-red",
                  isNp && "font-np",
                )}
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
