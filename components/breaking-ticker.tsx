"use client";

import { useEffect, useState } from "react";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import type { NewsItem } from "@/lib/news-pipeline";

interface BreakingTickerProps {
  items: NewsItem[];
  /** When the feed was last fetched — the timestamp shown is real, not decorative */
  fetchedAt: number;
}

const KATHMANDU_TZ = "Asia/Kathmandu";

/**
 * Full-bleed urgency bar.
 *
 * The clock ticks in Kathmandu time and is rendered only after mount: a live
 * clock in server HTML is guaranteed to be wrong by the time it reaches anyone,
 * and would hydrate-mismatch every single request.
 */
export function BreakingTicker({ items, fetchedAt }: BreakingTickerProps) {
  const { language, t } = useTheme();
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
    <div className="relative z-40 flex w-full items-stretch overflow-hidden bg-red-solid text-white">
      {/* Label block — stays pinned while headlines scroll past it */}
      <div className="relative z-10 flex shrink-0 items-center gap-2 bg-red-solid py-2 pr-4 pl-4 shadow-[8px_0_12px_-4px_var(--red-solid)] sm:pl-6">
        <span className="relative flex h-2 w-2 text-white">
          <span className="pulse-dot absolute inline-flex h-full w-full" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
        </span>
        <span className="eyebrow font-semibold">{t.liveLabel}</span>
        {clock && (
          <span
            className="eyebrow hidden tabular-nums opacity-90 sm:inline"
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
                  <span aria-hidden="true" className="text-white/60">
                    ◆
                  </span>
                  <span className="font-medium">{item.title}</span>
                </a>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Fetch time — the one number on this bar that is measured, not styled */}
      <div className="hidden shrink-0 items-center bg-red-solid pr-6 pl-4 shadow-[-8px_0_12px_-4px_var(--red-solid)] lg:flex">
        <span className="eyebrow tabular-nums opacity-90" suppressHydrationWarning>
          {t.updatedAt}{" "}
          {new Date(fetchedAt).toLocaleTimeString(
            language === "np" ? "ne-NP" : "en-GB",
            {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
              timeZone: KATHMANDU_TZ,
            },
          )}
        </span>
      </div>
    </div>
  );
}
