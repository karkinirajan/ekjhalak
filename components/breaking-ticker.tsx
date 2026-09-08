"use client";

import { useEffect, useState } from "react";
import { useSite } from "@/components/site-provider";
import { cn } from "@/lib/utils";
import type { NewsItem } from "@/lib/news-pipeline";

interface BreakingTickerProps {
  items: NewsItem[];
}

const KATHMANDU_TZ = "Asia/Kathmandu";

/**
 * Full-bleed urgency bar.
 *
 * Carries the live Kathmandu clock and the headlines, and nothing else. The
 * "updated at" stamp that used to sit on the right-hand end has moved next to
 * the refresh control in the masthead, where it says what it means: that button
 * is what changes the number, so the number belongs beside the button rather
 * than at the far edge of a scrolling marquee.
 *
 * The clock is rendered only after mount: a live clock in server HTML is
 * guaranteed to be wrong by the time it reaches anyone, and would hydrate-
 * mismatch every single request.
 */
export function BreakingTicker({ items }: BreakingTickerProps) {
  const { language, t } = useSite();
  const [clock, setClock] = useState<string | null>(null);

  useEffect(() => {
    const render = () =>
      setClock(
        new Date().toLocaleTimeString(language === "np" ? "ne-NP" : "en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: KATHMANDU_TZ,
        }),
      );

    render();
    const id = setInterval(render, 30_000);
    return () => clearInterval(id);
  }, [language]);

  if (items.length === 0) return null;

  // The marquee translates by -50%, so the headline list is rendered twice to
  // make the wrap seamless. The duplicate is hidden from assistive tech.
  const headlines = items.slice(0, 8);

  return (
    // `on-accent` declares this band's own token scope — see globals.css. The
    // band paints `bg-canvas`, which that scope defines as flag_red_400, so
    // the crimson comes from the same place its type and focus ring do rather
    // than from the literal #8b0000 this replaced, which was in no palette.
    <div className="on-accent relative z-40 flex w-full items-stretch overflow-hidden bg-canvas text-ink">
      {/* Label block — stays pinned while headlines scroll past it */}
      <div className="relative z-10 flex shrink-0 items-center gap-2 bg-canvas py-2 pr-4 pl-4 shadow-[8px_0_12px_-4px_var(--canvas)] sm:pl-6">
        <span className="relative flex h-2 w-2 text-ink">
          <span className="pulse-dot absolute inline-flex h-full w-full" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-ink" />
        </span>
        <span className="eyebrow font-semibold">{t.liveLabel}</span>
        {clock && (
          <span
            className="eyebrow hidden tabular-nums sm:inline"
            suppressHydrationWarning
          >
            {clock} NPT
          </span>
        )}
      </div>

      {/* Scrolling headlines */}
      <div className="relative flex min-w-0 flex-1 items-center overflow-hidden">
        <div className="ticker-track flex w-max items-center">
          {[0, 1].map((copy) => (
            <div
              key={copy}
              className="flex items-center"
              aria-hidden={copy === 1 ? "true" : undefined}
            >
              {headlines.map((item) => (
                <a
                  key={`${copy}-${item.id}`}
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  tabIndex={copy === 1 ? -1 : undefined}
                  className={cn(
                    "flex items-center gap-3 px-5 py-2 text-sm whitespace-nowrap transition-opacity hover:opacity-75",
                    item.originalLang === "np" && "font-np",
                  )}
                  lang={item.originalLang === "np" ? "ne" : "en"}
                >
                  <span aria-hidden="true" className="text-ink-muted">
                    ◆
                  </span>
                  <span className="font-medium">{item.title}</span>
                </a>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
