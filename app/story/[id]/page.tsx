// app/story/[id]/page.tsx
// Server-side story detail page.
// Fetches a single article from the API and displays it bilingually.

import { notFound } from "next/navigation";
import { Metadata } from "next";
import { ArrowLeft, Clock } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { newsArticleStructuredData, toJsonLd } from "@/lib/seo/structured-data";
import type { ApiArticle } from "@/lib/feed/serializers";
import { sanitizeTextForDisplay, splitIntoParagraphs } from "@/lib/utils";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.ekjhalak.news";

async function fetchArticle(id: string): Promise<ApiArticle | null> {
  try {
    const res = await fetch(`${SITE_URL}/api/story/${id}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.article ?? null;
  } catch {
    return null;
  }
}

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const article = await fetchArticle(id);
  if (!article) {
    return { title: "Story not found | एक झलक" };
  }
  return {
    title: `${article.title} | EJKN`,
    description: article.summary ?? article.title,
    openGraph: {
      title: article.title,
      description: article.summary ?? article.title,
      url: `${SITE_URL}/story/${article.id}`,
      type: "article",
      publishedTime: article.publishedAt,
      siteName: "EJKN",
    },
    twitter: {
      card: "summary",
      title: article.title,
      description: article.summary ?? article.title,
    },
  };
}

export default async function StoryPage({ params }: Props) {
  const { id } = await params;
  const article = await fetchArticle(id);
  if (!article) notFound();

  const jsonLd = toJsonLd(
    newsArticleStructuredData({
      title: article.title,
      description: article.summary,
      url: `${SITE_URL}/story/${article.id}`,
      publishedAt: article.publishedAt,
    }),
  );

  const formattedDate = new Date(article.publishedAt).toLocaleDateString(
    "en-US",
    {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd }}
      />

      <main className="min-h-screen bg-linear-to-br from-[#ffe7d6]/55 via-[#fff8ef] to-[#fffdf8] text-[#1b2435] dark:from-[#0a1323] dark:via-[#10192f] dark:to-[#16243f] dark:text-[#f2f6ff]">
        <div className="mx-auto w-full px-4 py-8 sm:w-[94vw] sm:max-w-[94vw] lg:max-w-3xl">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-6 -ml-2 gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to feed
            </Button>
          </Link>

          <article className="rounded-2xl border border-[#ffd4b7] bg-[#fffdfb]/95 p-6 shadow-[0_12px_26px_rgba(255,120,61,0.14)] dark:border-[#2d3c59] dark:bg-[#111b31]/95 dark:shadow-[0_12px_26px_rgba(5,10,21,0.5)]">
            <div className="mb-4 flex flex-wrap gap-2">
              <Badge
                variant={article.scope === "national" ? "default" : "secondary"}
                className={
                  article.scope === "national"
                    ? "bg-[#c53030] text-white border border-[#8f1f1f]"
                    : "bg-[#e9f8f1] text-[#1f6a4f] border border-[#97cdb7] dark:bg-[#0f2f2a] dark:text-[#9de5cd] dark:border-[#256557]"
                }
              >
                {article.scope === "national" ? "Nepal" : "International"}
              </Badge>
              {article.category && (
                <Badge
                  variant="outline"
                  className="rounded-full px-2.5 py-0.5 text-xs uppercase tracking-wide"
                >
                  {article.category}
                </Badge>
              )}
            </div>

            {(() => {
              const isNp = article.language === "np";
              const primaryTitle = article.title;
              const primaryBody = isNp
                ? (article.summaryNp ?? article.summary ?? "")
                : (article.summaryEn ?? article.summary ?? "");
              const primaryLang = isNp ? "ne" : "en";

              const safePrimaryTitle = sanitizeTextForDisplay(primaryTitle);
              const safePrimaryBody = sanitizeTextForDisplay(primaryBody);

              const primaryParas = splitIntoParagraphs(safePrimaryBody, 5);

              const isPrimaryNp = primaryLang === "ne";

              return (
                <>
                  <h1
                    className="mb-3 text-2xl font-bold leading-tight sm:text-3xl"
                    lang={primaryLang}
                    style={
                      isPrimaryNp
                        ? { fontFamily: "var(--font-devanagari), sans-serif" }
                        : undefined
                    }
                  >
                    {safePrimaryTitle}
                  </h1>

                  <div className="mb-6 flex flex-wrap items-center gap-4 border-b border-[#ffd9bf] pb-6 text-sm text-[#4d5a74] dark:border-[#273653] dark:text-[#b8c8e9]">
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      {formattedDate}
                    </span>
                  </div>

                  {primaryParas.length > 0 && (
                    <section className="space-y-4">
                      {primaryParas.map((p, i) => (
                        <p
                          key={i}
                          className="text-base leading-[1.9]"
                          lang={primaryLang}
                          style={
                            isPrimaryNp
                              ? {
                                  fontFamily:
                                    "var(--font-devanagari), sans-serif",
                                }
                              : undefined
                          }
                        >
                          {p}
                        </p>
                      ))}
                    </section>
                  )}
                </>
              );
            })()}
          </article>

          <footer className="mt-6 rounded-2xl border border-[#ffd9bf] bg-[#fff4ea]/80 px-4 py-4 text-center text-xs text-[#4d5a74] dark:border-[#2a3b5b] dark:bg-[#121d34]/90 dark:text-[#b8c8e9]">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <span suppressHydrationWarning>
                © {new Date().getFullYear()} EkJhalak News
              </span>
              <Link
                href="/"
                className="font-semibold text-[#1d3357] hover:underline dark:text-[#dce6ff]"
              >
                Back to live briefings
              </Link>
            </div>
          </footer>
        </div>
      </main>
    </>
  );
}
