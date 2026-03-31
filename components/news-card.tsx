"use client"

import { useState } from "react"
import { ExternalLink } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { cn, truncate } from "@/lib/utils"
import { useTheme } from "@/components/theme-provider"
import type { NewsItem } from "@/lib/news-pipeline"

interface NewsCardProps {
  item: NewsItem
}

export function NewsCard({ item }: NewsCardProps) {
  const { palette, language, t } = useTheme()
  const [briefOpen, setBriefOpen] = useState(false)

  const primary = language === "en" ? item.summaryEn : item.summaryNp
  const secondary = language === "en" ? item.summaryNp : item.summaryEn
  const primaryIsNp = language === "np"
  const secondaryIsNp = language === "en"

  const badge = item.bucket === "national" ? t.badgeNepal : t.badgeWorld
  const readAtLabel =
    language === "np"
      ? `${item.source}मा पढ्नुहोस्`
      : `${t.sourceLink === "Source" ? "Read at" : t.sourceLink} ${item.source}`

  return (
    <>
      <Card className={cn("rounded-[28px] border shadow-none transition", palette.card)}>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn("rounded-full px-2.5 py-1", palette.badge)}>
              {badge}
            </Badge>
            <span className={cn("text-xs", palette.muted)}>{item.source}</span>
            <span className={cn("text-xs", palette.muted)}>{item.publishedAt}</span>
          </div>
          <CardTitle className={cn("text-lg leading-snug", palette.text)}>{item.title}</CardTitle>
          <CardDescription className={cn("leading-6", primaryIsNp ? "font-np" : "", palette.subtext)}>
            {truncate(primary, 190)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className={cn(
              "rounded-2xl border p-3 text-sm leading-6",
              secondaryIsNp ? "font-np" : "",
              palette.soft,
              palette.muted
            )}
          >
            {truncate(secondary, 150)}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              className={cn("rounded-2xl", palette.accent)}
              onClick={() => setBriefOpen(true)}
            >
              {t.readBrief}
            </Button>
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className={cn(
                "inline-flex items-center gap-1 rounded-2xl px-3 py-1.5 text-sm font-medium transition-all",
                palette.ghost
              )}
            >
              <ExternalLink className="h-4 w-4" />
              {t.sourceLink}
            </a>
          </div>
        </CardContent>
      </Card>

      <Sheet open={briefOpen} onOpenChange={setBriefOpen}>
        <SheetContent
          side="right"
          className={cn("w-full overflow-y-auto sm:max-w-lg", palette.shell)}
        >
          <SheetTitle className={cn("pr-8 text-xl font-semibold leading-snug", palette.text)}>
            {item.title}
          </SheetTitle>
          <div className={cn("mt-1 flex flex-wrap items-center gap-2", palette.muted)}>
            <Badge variant="outline" className={cn("rounded-full px-2.5 py-1", palette.badge)}>
              {badge}
            </Badge>
            <span className="text-xs">{item.source}</span>
            <span className="text-xs">{item.publishedAt}</span>
          </div>

          <div className="mt-6 space-y-5">
            <div>
              <div className={cn("mb-2 text-xs font-medium uppercase tracking-[0.2em]", palette.muted)}>
                {primaryIsNp ? t.langLabelNp : t.langLabelEn}
              </div>
              <p className={cn("text-sm leading-7", primaryIsNp ? "font-np" : "", palette.subtext)}>
                {primary}
              </p>
            </div>

            <div className={cn("rounded-2xl border p-4", palette.panel)}>
              <div className={cn("mb-2 text-xs font-medium uppercase tracking-[0.2em]", palette.muted)}>
                {secondaryIsNp ? t.langLabelNp : t.langLabelEn}
              </div>
              <p className={cn("text-sm leading-7", secondaryIsNp ? "font-np" : "", palette.muted)}>
                {secondary}
              </p>
            </div>

            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className={cn(
                "inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium transition-all",
                palette.ghost
              )}
            >
              <ExternalLink className="h-4 w-4" />
              {readAtLabel}
            </a>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
