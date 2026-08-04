"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import { SITE_PAGES, type PageSlug } from "@/lib/site-pages";
import { STANDING_PAGES } from "@/lib/site-nav";

/**
 * The frame every standing page shares — about, editorial standards, privacy,
 * terms, contact.
 *
 * A client component because the page's language follows the same toggle the
 * feed uses, which lives in the theme provider. It renders one language of the
 * bilingual copy held in lib/site-pages.ts; nothing here writes prose of its own.
 *
 * Deliberately narrow. These are the pages a reader arrives at with a question —
 * who runs this, what happens to my email, why is this summary wrong — and a
 * single column at a readable measure answers faster than a designed layout.
 */
export function StandingPage({ slug }: { slug: PageSlug }) {
  const { language, t } = useTheme();
  const isNp = language === "np";
  const content = SITE_PAGES[slug][language];

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-rule">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link
            href="/"
            className={cn(
              "eyebrow inline-flex items-center gap-2 text-ink-muted transition-colors hover:text-ink",
              isNp && "font-np tracking-normal",
            )}
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            {t.backToNews}
          </Link>

          <p className="leading-none">
            <span
              className={cn(
                "text-lg font-semibold tracking-tight text-ink",
                isNp ? "font-np" : "font-display",
              )}
            >
              {t.wordmark}
            </span>
          </p>
        </div>
      </header>

      <article className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <p
          className={cn(
            "eyebrow text-red",
            isNp && "font-np tracking-normal",
          )}
        >
          {content.kicker}
        </p>

        <h1
          lang={isNp ? "ne" : "en"}
          className={cn(
            "headline mt-3 text-[2rem] leading-[1.15] font-semibold tracking-[-0.025em] text-ink sm:text-[2.6rem]",
            isNp ? "font-np leading-[1.35]" : "font-display",
          )}
        >
          {content.title}
        </h1>

        <p
          lang={isNp ? "ne" : "en"}
          className={cn(
            "copy mt-6 border-l border-red pl-5 text-[1.08rem] leading-[1.75] text-ink-soft",
            isNp && "font-np leading-[1.9]",
          )}
        >
          {content.intro}
        </p>

        <div className="mt-12 space-y-11">
          {content.sections.map((section) => (
            <section key={section.heading}>
              <h2
                lang={isNp ? "ne" : "en"}
                className={cn(
                  "text-[1.25rem] font-semibold tracking-[-0.015em] text-ink",
                  isNp ? "font-np" : "font-display",
                )}
              >
                {section.heading}
              </h2>
              <div className="mt-3 space-y-4">
                {section.body.map((paragraph, index) => (
                  <p
                    key={index}
                    lang={isNp ? "ne" : "en"}
                    className={cn(
                      "copy text-[1.02rem] leading-[1.8] text-ink-soft",
                      isNp && "font-np leading-[1.95]",
                    )}
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Sideways navigation. A reader who came to the privacy page for one
            answer usually has a second question, and it is nearly always on one
            of the other four. */}
        <nav
          aria-label={t.footerAbout}
          className="mt-16 border-t border-rule pt-7"
        >
          <ul className="flex flex-wrap gap-x-6 gap-y-2.5">
            {STANDING_PAGES.filter((page) => page.slug !== slug).map((page) => (
              <li key={page.slug}>
                <Link
                  href={page.href}
                  className={cn(
                    "text-sm text-ink-muted transition-colors hover:text-ink",
                    isNp && "font-np",
                  )}
                >
                  {t[page.labelKey]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </article>
    </div>
  );
}
