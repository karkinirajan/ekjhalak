"use client";

import { useState } from "react";
import Image from "next/image";
import { ExternalLink, Layers2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn, splitIntoParagraphs } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider";
import { getSourceById } from "@/lib/source-registry";
import type { NewsItem } from "@/lib/news-pipeline";

interface NewsCardProps {
  item: NewsItem;
}

export function NewsCard({ item }: NewsCardProps) {
  const { palette, language, t } = useTheme();
  const [briefOpen, setBriefOpen] = useState(false);
  const [imgError, setImgError] = useState(false);

  // ── Single-language display ───────────────────────────────────────────────
  // Show only the selected language. Fall back to English when a Nepali
  // summary isn't yet available.
  const isNepaliMode = language === "np";
  const summary = isNepaliMode
    ? item.summaryNp || item.summaryEn
    : item.summaryEn;
  const title = isNepaliMode ? item.titleNp || item.title : item.title;
  const isNepali = isNepaliMode && !!item.summaryNp;
  const isTitleNepali = isNepaliMode && !!item.titleNp;

  const badge = item.bucket === "national" ? t.badgeNepal : t.badgeWorld;
  const readAtLabel = isNepaliMode
    ? `${item.source}मा पढ्नुहोस्`
    : `Read at ${item.source}`;

  const showImage = !!item.imageUrl && !imgError;

  // Alternate sources ── full list for sheet, preview for card chip
  const altCount = item.alternateSourceIds?.length ?? 0;
  const allAlternates =
    item.alternateSourceIds?.map((id) => getSourceById(id)?.name ?? id) ?? [];
  const alternatePreview = allAlternates.slice(0, 3).join(", ");

  // Split the full summary into up to 3 paragraphs for the detail sheet
  const paragraphs = splitIntoParagraphs(summary ?? "", 3);

  return (
    <>
      {/* ── Card ──────────────────────────────────────────────────────── */}
      <article aria-label={title}>
        <Card
          className={cn(
            "border rounded-lg overflow-hidden transition-all duration-200",
            palette.card,
          )}
        >
          {/*
           * Two-column layout:
           * mobile  → image stacked above content (flex-col)
           * sm+     → image on the left, content on the right (flex-row)
           */}
          <div className="flex flex-col sm:flex-row min-h-0">
            {/* Left / Top: Lead image */}
            {showImage && (
              <div
                className={cn(
                  // relative + explicit height required for next/image fill mode
                  "relative w-full sm:w-1/3 shrink-0 overflow-hidden h-36 sm:h-auto sm:min-h-35",
                  palette.image,
                )}
              >
                <Image
                  src={item.imageUrl!}
                  alt={title}
                  fill
                  sizes="(max-width: 640px) 100vw, 33vw"
                  className="object-cover"
                  onError={() => setImgError(true)}
                />
              </div>
            )}

            {/* Right / Bottom: Content */}
            <div className="flex flex-1 flex-col min-w-0">
              <CardHeader className="pb-1.5 pt-3 px-4">
                {/* Meta row */}
                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      "rounded-md px-2 py-0.5 text-xs font-medium",
                      palette.badge,
                    )}
                  >
                    {badge}
                  </Badge>
                  {item.category && (
                    <Badge
                      variant="outline"
                      className={cn(
                        "rounded-md px-2 py-0.5 text-xs capitalize opacity-70",
                        palette.badge,
                      )}
                    >
                      {item.category}
                    </Badge>
                  )}
                  <span className={cn("text-xs font-medium", palette.subtext)}>
                    {item.source}
                  </span>
                  <span className={cn("text-xs", palette.muted)}>·</span>
                  <span className={cn("text-xs", palette.muted)}>
                    {item.publishedAt}
                  </span>
                </div>

                {/* Headline */}
                <CardTitle
                  className={cn(
                    "text-[15px] font-semibold leading-snug tracking-tight",
                    isTitleNepali ? "font-np text-base" : "",
                    palette.text,
                  )}
                >
                  {title}
                </CardTitle>

                {/* Summary — strictly the selected language */}
                {summary && (
                  <CardDescription
                    className={cn(
                      "text-sm leading-relaxed mt-1.5 line-clamp-4 md:line-clamp-3 xl:line-clamp-2",
                      isNepali ? "font-np" : "",
                      palette.subtext,
                    )}
                  >
                    {summary}
                  </CardDescription>
                )}
              </CardHeader>

              <CardContent className="px-4 pb-3.5 pt-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    className={cn(
                      "rounded-md h-8 px-3 text-xs",
                      palette.accent,
                    )}
                    onClick={() => setBriefOpen(true)}
                  >
                    {t.readBrief}
                  </Button>
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all h-8",
                      palette.ghost,
                    )}
                    aria-label={readAtLabel}
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    {t.sourceLink}
                  </a>

                  {/* "Also reported by" chip */}
                  {altCount > 0 && (
                    <span
                      title={`Also reported by: ${alternatePreview}${altCount > 3 ? ` and ${altCount - 3} more` : ""}`}
                      className={cn(
                        "inline-flex items-center gap-1 text-[11px] opacity-60",
                        palette.muted,
                      )}
                    >
                      <Layers2 className="h-3 w-3" />+{altCount}{" "}
                      {isNepaliMode
                        ? altCount === 1
                          ? "स्रोत"
                          : "स्रोतहरू"
                        : altCount === 1
                          ? "source"
                          : "sources"}
                    </span>
                  )}
                </div>
              </CardContent>
            </div>
          </div>
        </Card>
      </article>

      {/* ── Detail sheet ──────────────────────────────────────────────── */}
      {/*
       * Width:   sm:max-w-2xl (≈672 px) — wider than the default lg panel.
       * Content: full summary split into up to 3 paragraphs for longer text;
       *          short/minimal content shown cleanly as-is.
       */}
      <Sheet open={briefOpen} onOpenChange={setBriefOpen}>
        <SheetContent
          side="right"
          className={cn(
            "w-full overflow-y-auto sm:max-w-2xl p-0",
            palette.shell,
          )}
        >
          {/* Hero image — compact inside the sheet */}
          {showImage && (
            <div className={cn("relative w-full h-48 overflow-hidden", palette.image)}>
              <Image
                src={item.imageUrl!}
                alt={title}
                fill
                sizes="(max-width: 768px) 100vw, 672px"
                className="object-cover"
              />
            </div>
          )}

          <div className="p-6 space-y-5">
            {/* Meta row */}
            <div
              className={cn(
                "flex flex-wrap items-center gap-1.5",
                palette.muted,
              )}
            >
              <Badge
                variant="outline"
                className={cn("rounded-md px-2 py-0.5 text-xs", palette.badge)}
              >
                {badge}
              </Badge>
              {item.category && (
                <Badge
                  variant="outline"
                  className={cn(
                    "rounded-md px-2 py-0.5 text-xs capitalize opacity-70",
                    palette.badge,
                  )}
                >
                  {item.category}
                </Badge>
              )}
              <span className={cn("text-xs font-medium", palette.subtext)}>
                {item.source}
              </span>
              <span className={cn("text-xs", palette.muted)}>·</span>
              <span className={cn("text-xs", palette.muted)}>
                {item.publishedAt}
              </span>
            </div>

            {/* Headline */}
            <SheetTitle
              className={cn(
                "text-xl font-semibold leading-snug",
                isTitleNepali ? "font-np text-2xl" : "",
                palette.text,
              )}
            >
              {title}
            </SheetTitle>

            {/* ── Summary content ───────────────────────────────────── */}
            {/*
             * Long text  → split into up to 3 paragraphs at sentence boundaries
             * Short text → single block, shown cleanly without artificial padding
             * No text    → graceful empty-state message
             */}
            {paragraphs.length > 0 ? (
              <div className="space-y-4">
                {paragraphs.map((para, i) => (
                  <p
                    key={i}
                    className={cn(
                      "text-sm leading-[1.9]",
                      isNepali ? "font-np text-base" : "",
                      palette.subtext,
                    )}
                  >
                    {para}
                  </p>
                ))}
              </div>
            ) : (
              <p
                className={cn(
                  "text-sm leading-[1.75] italic opacity-60",
                  palette.muted,
                )}
              >
                {isNepaliMode
                  ? "विस्तृत विवरण उपलब्ध छैन।"
                  : "No detailed summary available for this story."}
              </p>
            )}

            {/* ── Also covered by ───────────────────────────────────── */}
            {altCount > 0 && (
              <div className={cn("border-t pt-4 space-y-2", palette.muted)}>
                <p className="text-[11px] uppercase tracking-widest opacity-60">
                  {isNepaliMode
                    ? "यो खबर यी स्रोतहरूमा पनि प्रकाशित छ"
                    : "Also reported by"}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {allAlternates.map((name, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className={cn(
                        "rounded-md px-2 py-0.5 text-xs font-normal opacity-75",
                        palette.badge,
                      )}
                    >
                      {name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* ── Read full article link ────────────────────────────── */}
            <div className={cn("border-t pt-4 mt-2", palette.muted)}>
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noreferrer noopener"
                className={cn(
                  "inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-all w-full sm:w-auto",
                  palette.accent,
                )}
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                {readAtLabel}
              </a>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
