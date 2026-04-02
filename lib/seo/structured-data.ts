// lib/seo/structured-data.ts
// JSON-LD structured data generators for news articles and the site.

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.ekjhalak.news";
const SITE_NAME = "एक झलक";

export interface NewsArticleData {
  title: string;
  description?: string | null;
  url: string;
  imageUrl?: string | null;
  publishedAt?: string | null;
  sourceName?: string | null;
}

/**
 * NewsArticle JSON-LD for story pages.
 * https://schema.org/NewsArticle
 */
export function newsArticleStructuredData(article: NewsArticleData): object {
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    description: article.description ?? undefined,
    url: article.url,
    datePublished: article.publishedAt ?? undefined,
    image: article.imageUrl
      ? { "@type": "ImageObject", url: article.imageUrl }
      : undefined,
    publisher: {
      "@type": "Organization",
      name: article.sourceName ?? SITE_NAME,
      url: SITE_URL,
      logo: { "@type": "ImageObject", url: `${SITE_URL}/logo.svg` },
    },
    isAccessibleForFree: true,
    inLanguage: ["en", "ne"],
  };
}

/**
 * WebSite JSON-LD for the homepage.
 */
export function websiteStructuredData(): object {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    description:
      "Fast, bilingual news aggregator for Nepal and the world. Clean, ad-free, trusted sources.",
    inLanguage: ["en", "ne"],
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/?search={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/**
 * Serialize a structured data object to a script tag string (server-side).
 */
export function toJsonLd(data: object): string {
  return JSON.stringify(data);
}
