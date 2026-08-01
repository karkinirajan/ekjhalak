"use client";

import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import { TOPIC_ORDER, topicLabel, type TopicId } from "@/lib/taxonomy";

interface SiteFooterProps {
  /** Distinct newsrooms that returned stories in this fetch */
  sourceCount: number;
  onTopicSelect: (topic: TopicId) => void;
}

/**
 * The closing panel — the step furthest from the type in either theme, so it
 * reads as the page's anchor whether that means blackest or whitest. Carries
 * the attribution obligations an aggregator has toward the newsrooms it
 * reprints.
 */
export function SiteFooter({ sourceCount, onTopicSelect }: SiteFooterProps) {
  const { t, language } = useTheme();
  const isNp = language === "np";
  const year = new Date().getFullYear();

  return (
    <footer className="mt-20 border-t border-rule bg-pitch text-ink-soft">
      <div className="mx-auto w-full max-w-[1400px] px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-[1.6fr_1fr_1fr]">
          {/* Brand + about */}
          <div className="max-w-sm">
            <p className="leading-none">
              <span
                className={cn(
                  "text-2xl font-black tracking-tight text-ink",
                  isNp ? "font-np" : "font-display",
                )}
              >
                {t.wordmark}
              </span>
              <span
                className={cn(
                  "ml-2.5 text-base font-semibold text-red",
                  isNp ? "font-display" : "font-np",
                )}
              >
                {t.wordmarkNp}
              </span>
            </p>

            <p
              className={cn(
                "copy mt-4 text-sm leading-relaxed text-ink-soft",
                isNp && "font-np",
              )}
            >
              {t.footerAboutText}
            </p>

            <p className="eyebrow mt-5 text-ink-muted">
              {t.footerSourcesText}{" "}
              <span className="tabular-nums text-red">{sourceCount}</span>{" "}
              {t.footerNewsrooms}
            </p>
          </div>

          {/* Sections */}
          <nav aria-label={t.footerSections}>
            <h2
              className={cn(
                "eyebrow text-ink",
                isNp && "font-np tracking-normal",
              )}
            >
              {t.footerSections}
            </h2>
            <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5">
              {TOPIC_ORDER.map((id) => (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => onTopicSelect(id)}
                    className={cn(
                      "text-sm text-ink-soft transition-colors hover:text-ink",
                      isNp && "font-np",
                    )}
                  >
                    {topicLabel(id, language)}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {/* Credits */}
          <div>
            <h2
              className={cn(
                "eyebrow text-ink",
                isNp && "font-np tracking-normal",
              )}
            >
              {t.footerAbout}
            </h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <a
                  href="https://kneeraazon.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ink-soft transition-colors hover:text-ink"
                >
                  kneeraazon
                </a>
              </li>
              <li>
                <a
                  href="/sitemap.xml"
                  className="text-ink-soft transition-colors hover:text-ink"
                >
                  Sitemap
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Attribution notice — an aggregator owes its sources this line */}
        <div className="mt-12 flex flex-col gap-4 border-t border-rule pt-7 sm:flex-row sm:items-center sm:justify-between">
          <p
            className={cn(
              "max-w-xl text-xs leading-relaxed text-ink-muted",
              isNp && "font-np",
            )}
          >
            {t.footerDisclaimer}
          </p>
          <p
            className="eyebrow shrink-0 text-ink-muted"
            suppressHydrationWarning
          >
            © {year} {t.wordmark} · {t.footerRights}
          </p>
        </div>
      </div>
    </footer>
  );
}
