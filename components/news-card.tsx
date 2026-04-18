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

const LIST_SUMMARY_MAX_CHARS = 360;

export function NewsCard({ item }: NewsCardProps) {
  const { palette, t } = useTheme();
  const [briefOpen, setBriefOpen] = useState(false);

  const isNp = item.originalLang === "np";
  const title = sanitizeTextForDisplay(item.title);
  const summary = sanitizeTextForDisplay(item.summary);
  const listSummary = truncate(summary, LIST_SUMMARY_MAX_CHARS);
  const paragraphs = splitIntoParagraphs(summary, 5);
  const langAttr = isNp ? "ne" : "en";
  const fontClass = isNp ? "font-np" : "font-display";

  return (
    <>
      <article aria-label={title}>
        <Card
          className={cn(
            "border rounded-2xl overflow-hidden transition-all duration-200",
            palette.card,
          )}
        >
          <CardHeader className="px-5 pt-4 pb-1.5">
            <CardTitle
              lang={langAttr}
              className={cn(
                "text-[17px] font-semibold leading-snug tracking-tight",
                isNp && "text-lg",
                fontClass,
                palette.text,
              )}
            >
              {title}
            </CardTitle>

            {listSummary && (
              <CardDescription
                lang={langAttr}
                className={cn(
                  "mt-2 text-sm leading-relaxed",
                  isNp && "font-np",
                  palette.subtext,
                )}
              >
                {listSummary}
              </CardDescription>
            )}
          </CardHeader>

          <CardContent className="px-5 pt-0 pb-4">
            <Button
              size="sm"
              className={cn("rounded-xl h-8 px-3 text-xs", palette.accent)}
              onClick={() => setBriefOpen(true)}
            >
              {t.readBrief}
            </Button>
          </CardContent>
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
            <span className={cn("text-xs", palette.muted)}>
              {item.publishedAt}
            </span>

            <SheetTitle
              lang={langAttr}
              className={cn(
                "text-xl font-semibold leading-snug",
                isNp && "text-2xl font-np",
                !isNp && "font-display",
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
                    lang={langAttr}
                    className={cn(
                      "text-[15px] leading-[1.85]",
                      isNp && "text-base font-np",
                      palette.subtext,
                    )}
                  >
                    {para}
                  </p>
                ))}
              </div>
            ) : (
              <p className={cn("text-sm italic opacity-60", palette.muted)}>
                {t.noStories}
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
