import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, Clock, Newspaper, Users } from "lucide-react";

import { StoryImage } from "@/components/story-image";
import { SourceMark, TopicPill } from "@/components/topic-pill";
import { findStory } from "@/lib/story-lookup";
import { storyExcerpt, isTruncated } from "@/lib/story-excerpt";
import { langAttr } from "@/lib/story-text";
import { getSourceById } from "@/lib/source-registry";
import { topicLabel } from "@/lib/taxonomy";
import { cn, sanitizeTextForDisplay, splitIntoParagraphs } from "@/lib/utils";
import { SITE_NAME, SITE_URL, storyUrl } from "@/lib/site-url";
import type { NewsItem } from "@/lib/news-pipeline";

// Rendered per request, not cached as a static page.
//
// This is about the status code, not freshness. Under ISR, `notFound()` for an
// unknown id produced the not-found UI with **HTTP 200** — a soft 404, which is
// exactly what the spec forbids, and which tells a crawler an expired permalink
// is a live page worth keeping in the index. Measured: 200 with
// `revalidate = 900`, 404 without.
//
// It costs almost nothing. The expensive part is aggregation, and that already
// sits behind `getCachedFeed`'s five-minute `unstable_cache`; what happens per
// request is finding one item in an array and rendering it.
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * The story, in the language its newsroom published it.
 *
 * Deliberately not the reader's toggled UI language. This page is the indexable,
 * shareable artifact for one article, and the honest canonical version of an
 * article is the one that was written — a Nepali story served under `lang="en"`
 * with an English machine translation as its primary text is both worse for a
 * screen reader and, per the Phase 0 audit, the reason the Nepali half of this
 * site is invisible to search. The translation is offered underneath, marked up
 * in its own language.
 */
function storyLang(item: NewsItem) {
  return langAttr(item.originalLang);
}

async function load(params: PageProps["params"]) {
  const { id } = await params;
  const found = await findStory(id);
  if (!found) notFound();
  return found;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  // `notFound()` here as well as in the page, not just a "Story not found"
  // title. Returning metadata for a story that does not exist produces a soft
  // 404 — the not-found UI rendered under HTTP 200 — which tells a crawler the
  // URL is fine and to keep it indexed.
  const found = await findStory(id);
  if (!found) notFound();

  const { item } = found;
  const title = sanitizeTextForDisplay(item.title);
  // The same cap that governs the page body governs its description. An og
  // description is reader-facing text that gets copied into other people's
  // surfaces, so it is bound by the display cap like everything else.
  const description = storyExcerpt(
    sanitizeTextForDisplay(item.summary),
    200,
  );
  const url = storyUrl(item.id);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      siteName: SITE_NAME,
      title,
      description,
      locale: item.originalLang === "np" ? "ne_NP" : "en_US",
      publishedTime: new Date(item.publishedTimestamp).toISOString(),
      images: item.imageUrl ? [{ url: item.imageUrl, alt: title }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: item.imageUrl ? [item.imageUrl] : undefined,
    },
  };
}

export default async function StoryPage({ params }: PageProps) {
  const { item, related } = await load(params);

  const source = getSourceById(item.sourceId);
  const lang = storyLang(item);
  const isNp = item.originalLang === "np";
  const title = sanitizeTextForDisplay(item.title);
  const fullSummary = sanitizeTextForDisplay(item.summary);
  const excerpt = storyExcerpt(fullSummary);
  const capped = isTruncated(fullSummary);
  const paragraphs = splitIntoParagraphs(excerpt, 3);

  // A separate, short summary for the structured data below.
  //
  // The JSON-LD used `excerpt`, which is the rendered page body and runs to
  // EXCERPT_MAX_CHARS — 2500. schema.org `description` is a summary, not the
  // article, and every consumer of it truncates: `pnpm run check:seo` caps it
  // at 400 and caught this at 2354. 200 matches what `generateMetadata` already
  // computes for the og and twitter descriptions, so all three surfaces now
  // quote the same sentence rather than three different lengths of it.
  const schemaDescription = storyExcerpt(fullSummary, 200);

  const translatedTitle = item.titleTranslated
    ? sanitizeTextForDisplay(item.titleTranslated)
    : null;
  const translatedSummary = item.summaryTranslated
    ? storyExcerpt(sanitizeTextForDisplay(item.summaryTranslated))
    : null;
  const translatedLang = isNp ? "en" : "ne";

  const published = new Date(item.publishedTimestamp);
  const url = storyUrl(item.id);

  // `author` is the originating newsroom, never EkJhalak. That is the accurate
  // claim and it is also the one that makes this schema safe to publish: the
  // page says, in machine-readable form, that someone else wrote this and we are
  // pointing at it. `publisher` is EkJhalak because we published this page.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: title,
    description: schemaDescription,
    datePublished: published.toISOString(),
    dateModified: published.toISOString(),
    inLanguage: lang,
    isAccessibleForFree: true,
    author: {
      "@type": "Organization",
      name: item.sourceName,
      ...(source?.homepageUrl ? { url: source.homepageUrl } : {}),
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/android-chrome-512x512.png`,
        width: 512,
        height: 512,
      },
    },
    ...(item.imageUrl ? { image: [item.imageUrl] } : {}),
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    // The canonical article this page is about. Without it the schema describes
    // a page whose body is 400 characters long as though that were the article.
    isBasedOn: item.sourceUrl,
    url,
  };

  return (
    <article data-topic={item.topic} className="mx-auto max-w-3xl px-5 py-8 sm:py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <nav aria-label="Breadcrumb" className="eyebrow mb-6 text-ink-muted">
        <Link href="/" className="transition-colors hover:text-ink">
          ← All stories
        </Link>
      </nav>

      <div className="flex flex-wrap items-center gap-2.5">
        <TopicPill topic={item.topic} lang={item.originalLang} tone="solid" />
        <SourceMark name={item.sourceName} className="eyebrow text-ink-muted" />
        <span className="eyebrow inline-flex items-center gap-1.5 text-ink-muted">
          <Clock aria-hidden="true" className="h-3 w-3" />
          <time dateTime={published.toISOString()}>{item.publishedAt}</time>
        </span>
        {item.coverageCount > 1 && (
          <span className="eyebrow inline-flex items-center gap-1.5 text-ink-muted">
            <Users aria-hidden="true" className="h-3 w-3" />
            {item.coverageCount} outlets covering
          </span>
        )}
      </div>

      <h1
        lang={lang}
        className={cn(
          "headline mt-4 text-[clamp(1.7rem,5vw,2.7rem)] font-semibold tracking-tight text-ink",
          isNp ? "font-np leading-[1.4]" : "font-display leading-[1.12]",
        )}
      >
        {title}
      </h1>

      {/* The outbound link sits here, above the excerpt, on purpose. This page
          holds at most 400 characters of someone else's reporting; the thing a
          reader actually wants is one tap away and it should not be at the
          bottom of the page. It is also the primary action visually, not a
          secondary "source" credit in small grey type. */}
      <p className="mt-6">
        <a
          href={item.sourceUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="card-focus inline-flex items-center gap-2 rounded-md bg-[var(--topic)] px-4 py-2.5 text-sm font-semibold text-topic-ink transition-opacity hover:opacity-90"
        >
          Read the full story at {item.sourceName}
          <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
        </a>
      </p>

      {item.imageUrl && (
        <div className="mt-8 aspect-16/10 w-full overflow-hidden rounded-md bg-raised/60">
          <StoryImage
            src={item.imageUrl}
            alt={title}
            topic={item.topic}
            priority
            sizes="(min-width: 768px) 768px, 100vw"
            className="h-full w-full"
          />
        </div>
      )}

      <div className="mt-8">
        {paragraphs.map((paragraph, index) => (
          <p
            key={index}
            lang={lang}
            className={cn(
              "copy text-[1.05rem] leading-[1.85] text-ink-soft",
              index > 0 && "mt-4",
              isNp && "font-np leading-[1.95]",
            )}
          >
            {paragraph}
          </p>
        ))}

        {/* Said out loud rather than implied by an ellipsis. A reader is
            entitled to know they are looking at an excerpt by design and not a
            story that happened to be short. */}
        {capped && (
          <p className="eyebrow mt-5 text-ink-muted">
            This is a short excerpt. EkJhalak links out rather than reproducing
            other newsrooms&rsquo; work —{" "}
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="underline underline-offset-4 transition-colors hover:text-ink"
            >
              continue at {item.sourceName}
            </a>
            .
          </p>
        )}
      </div>

      {translatedSummary && (
        <section
          aria-labelledby="translation-heading"
          className="mt-10 rounded-md border border-rule bg-surface p-5 sm:p-6"
        >
          <h2
            id="translation-heading"
            className="eyebrow flex items-center gap-2 text-ink-muted"
          >
            <Newspaper aria-hidden="true" className="h-3.5 w-3.5" />
            {isNp ? "In English" : "नेपालीमा"}
          </h2>
          {translatedTitle && (
            <p
              lang={translatedLang}
              className={cn(
                "mt-3 text-lg font-semibold text-ink",
                translatedLang === "ne"
                  ? "font-np leading-[1.5]"
                  : "font-display",
              )}
            >
              {translatedTitle}
            </p>
          )}
          <p
            lang={translatedLang}
            className={cn(
              "copy mt-2.5 leading-[1.8] text-ink-soft",
              translatedLang === "ne" && "font-np leading-[1.95]",
            )}
          >
            {translatedSummary}
          </p>
          <p className="eyebrow mt-3 text-ink-muted">
            Machine translation — the original above is the story as filed.
          </p>
        </section>
      )}

      {related.length > 0 && (
        <section aria-labelledby="related-heading" className="mt-12">
          <h2
            id="related-heading"
            className="font-display text-lg font-bold tracking-tight text-ink"
          >
            More {topicLabel(item.topic, "en").toLowerCase()}
          </h2>
          <ul className="mt-4 divide-y divide-rule border-t border-rule">
            {related.map((other) => (
              <li key={other.id}>
                <Link
                  href={`/story/${other.id}`}
                  className="card-focus group flex items-baseline gap-3 py-3"
                >
                  <span
                    lang={langAttr(other.originalLang)}
                    className={cn(
                      "flex-1 text-[0.98rem] leading-snug text-ink transition-colors group-hover:text-(--topic-text)",
                      other.originalLang === "np"
                        ? "font-np leading-[1.5]"
                        : "font-display",
                    )}
                  >
                    {sanitizeTextForDisplay(other.title)}
                  </span>
                  <span className="eyebrow shrink-0 text-ink-muted">
                    {other.sourceName}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
