"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  cn,
  sanitizeTextForDisplay,
  splitIntoParagraphs,
  truncate,
} from "@/lib/utils";
import { useTheme } from "@/components/theme-provider";
import type { NewsItem } from "@/lib/news-pipeline";

interface NewsCardProps {
  item: NewsItem;
}

// Keep list summaries concise while allowing enough room for Nepali script.
const LIST_SUMMARY_MAX_CHARS = 430;

export function NewsCard({ item }: NewsCardProps) {
  const { palette, language, t } = useTheme();
  const [briefOpen, setBriefOpen] = useState(false);

  const isOriginalNp = item.originalLang === "np";
  const summary = sanitizeTextForDisplay(
    isOriginalNp
      ? item.briefNp || item.summaryNp || ""
      : item.briefEn || item.summaryEn || "",
  );
  const listSummary = truncate(summary ?? "", LIST_SUMMARY_MAX_CHARS);
  const title = sanitizeTextForDisplay(item.title || "");
  const summaryLang = isOriginalNp ? "np" : "en";
  const titleLang = isOriginalNp ? "np" : "en";
  const paragraphs = splitIntoParagraphs(summary ?? "", 5);

  return (
    <>
      <article aria-label={title}>
        <Card
          className={cn(
            "border rounded-2xl overflow-hidden transition-all duration-200",
            palette.card,
          )}
        >
          <div className="flex min-h-0 flex-col">
            <CardHeader className="pb-1.5 pt-4 px-5">
              <CardTitle
                className={cn(
                  "text-[17px] font-semibold leading-snug tracking-tight",
                  titleLang === "np" ? "font-np text-lg" : "font-display",
                  palette.text,
                )}
              >
                {title}
              </CardTitle>

              {listSummary && (
                <CardDescription
                  className={cn(
                    "text-sm leading-relaxed mt-2",
                    summaryLang === "np" ? "font-np" : "",
                    palette.subtext,
                  )}
                >
                  {listSummary}
                </CardDescription>
              )}
            </CardHeader>

            <CardContent className="px-5 pb-4 pt-0">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  className={cn("rounded-xl h-8 px-3 text-xs", palette.accent)}
                  onClick={() => setBriefOpen(true)}
                >
                  {t.readBrief}
                </Button>
              </div>
            </CardContent>
          </div>
        </Card>
      </article>

      <Sheet open={briefOpen} onOpenChange={setBriefOpen}>
        <SheetContent
          side="right"
          className={cn(
            "w-full overflow-y-auto sm:max-w-2xl p-0",
            palette.shell,
          )}
        >
          <div className="p-6 space-y-5">
            <div
              className={cn(
                "flex flex-wrap items-center gap-1.5",
                palette.muted,
              )}
            >
              <span className={cn("text-xs", palette.muted)}>
                {item.publishedAt}
              </span>
            </div>

            <SheetTitle
              className={cn(
                "text-xl font-semibold leading-snug",
                titleLang === "np" ? "font-np text-2xl" : "font-display",
                palette.text,
              )}
            >
              {title}
            </SheetTitle>

            {paragraphs.length > 0 ? (
              <div className="space-y-4">
                {paragraphs.map((para, i) => (
                  <p
                    key={i}
                    lang={summaryLang === "np" ? "ne" : "en"}
                    className={cn(
                      "text-sm leading-[1.9]",
                      summaryLang === "np" ? "font-np text-base" : "",
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
                {language === "np"
                  ? "विस्तृत विवरण उपलब्ध छैन।"
                  : "No detailed summary available for this story."}
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
