// app/story/[id]/page.tsx
// Server-side story detail page.
// Fetches a single article from the API and displays it bilingually.

import { notFound } from "next/navigation";
import { Metadata } from "next";
import { ArrowLeft, ExternalLink, Clock, Globe } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { newsArticleStructuredData, toJsonLd } from "@/lib/seo/structured-data";
import type { ApiArticle } from "@/lib/feed/serializers";

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
    title: `${article.title} | एक झलक`,
    description: article.summary ?? article.title,
    openGraph: {
      title: article.title,
      description: article.summary ?? article.title,
      url: `${SITE_URL}/story/${article.id}`,
      images: article.imageUrl ? [{ url: article.imageUrl }] : [],
      type: "article",
      publishedTime: article.publishedAt,
      siteName: "एक झलक",
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.summary ?? article.title,
      images: article.imageUrl ? [article.imageUrl] : undefined,
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
      imageUrl: article.imageUrl,
      publishedAt: article.publishedAt,
      sourceName: article.sourceName,
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

      <main className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-4 py-8">
          {/* Back navigation */}
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-6 -ml-2 gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to feed
            </Button>
          </Link>

          {/* Badges */}
          <div className="flex flex-wrap gap-2 mb-4">
            <Badge
              variant={article.scope === "national" ? "default" : "secondary"}
            >
              {article.scope === "national" ? "Nepal" : "International"}
            </Badge>
            {article.category && (
              <Badge variant="outline">{article.category}</Badge>
            )}
          </div>

          {/* English headline */}
          <h1 className="text-2xl sm:text-3xl font-bold leading-tight text-foreground mb-3">
            {article.title}
          </h1>

          {/* Nepali headline */}
          {article.titleNp && (
            <h2
              className="text-xl sm:text-2xl font-semibold leading-snug text-muted-foreground mb-6"
              lang="ne"
              style={{ fontFamily: "var(--font-devanagari), sans-serif" }}
            >
              {article.titleNp}
            </h2>
          )}

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-6 pb-6 border-b">
            <span className="flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" />
              {article.sourceName}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {formattedDate}
            </span>
          </div>

          {/* Lead image */}
          {article.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={article.imageUrl}
              alt={article.title}
              className="w-full rounded-lg mb-6 object-cover max-h-96"
              loading="lazy"
            />
          )}

          {/* English summary */}
          {article.summary && (
            <div className="mb-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Summary
              </h3>
              <p className="text-base leading-relaxed text-foreground">
                {article.summary}
              </p>
            </div>
          )}

          {/* Nepali summary */}
          {article.summaryNp && (
            <div className="mb-6 p-4 rounded-lg bg-muted/40">
              <h3
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2"
                lang="ne"
              >
                सारांश
              </h3>
              <p
                className="text-base leading-relaxed text-foreground"
                lang="ne"
                style={{ fontFamily: "var(--font-devanagari), sans-serif" }}
              >
                {article.summaryNp}
              </p>
            </div>
          )}

          {/* Read original */}
          <div className="pt-4 border-t">
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2"
            >
              <Button className="gap-2" variant="default">
                Read original at {article.sourceName}
                <ExternalLink className="h-4 w-4" />
              </Button>
            </a>
          </div>

          {/* Alternate sources */}
          {article.alternateSourceIds &&
            article.alternateSourceIds.length > 0 && (
              <div className="mt-6 pt-6 border-t">
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                  Also reported by {article.alternateSourceIds.length} other
                  source
                  {article.alternateSourceIds.length > 1 ? "s" : ""}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {article.alternateSourceIds.map((sid) => (
                    <Badge key={sid} variant="outline" className="text-xs">
                      {sid}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
        </div>
      </main>
    </>
  );
}
