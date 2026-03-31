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
      <Card className={cn("border rounded-md transition-all duration-200", palette.card)}>
        <CardHeader className="pb-1 pt-3 px-4">
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            <Badge variant="outline" className={cn("rounded-md px-2 py-0.5 text-xs", palette.badge)}>
              {badge}
            </Badge>
            <span className={cn("text-xs", palette.muted)}>{item.source}</span>
            <span className={cn("text-xs", palette.muted)}>·</span>
            <span className={cn("text-xs", palette.muted)}>{item.publishedAt}</span>
          </div>
          <CardTitle className={cn("text-base font-semibold leading-snug", palette.text)}>{item.title}</CardTitle>
          <CardDescription className={cn("text-sm leading-relaxed mt-1", primaryIsNp ? "font-np" : "", palette.subtext)}>
            {truncate(primary, 1200)}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2 px-4 pb-4">
          <Button
            size="sm"
            className={cn("rounded-md h-8 px-3", palette.accent)}
            onClick={() => setBriefOpen(true)}
          >
            {t.readBrief}
          </Button>
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all h-8",
              palette.ghost
            )}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {t.sourceLink}
          </a>
        </CardContent>
      </Card>

      <Sheet open={briefOpen} onOpenChange={setBriefOpen}>
        <SheetContent
          side="right"
          className={cn("w-full overflow-y-auto sm:max-w-md p-4", palette.shell)}
        >
          <SheetTitle className={cn("pr-6 text-lg font-semibold leading-snug", palette.text)}>
            {item.title}
          </SheetTitle>
          <div className={cn("mt-1 flex flex-wrap items-center gap-1.5", palette.muted)}>
            <Badge variant="outline" className={cn("rounded-md px-2 py-0.5 text-xs", palette.badge)}>
              {badge}
            </Badge>
            <span className="text-xs">{item.source}</span>
            <span className="text-xs">·</span>
            <span className="text-xs">{item.publishedAt}</span>
          </div>

          <div className="mt-4 space-y-4">
            <div>
              <p className={cn("text-sm leading-relaxed", primaryIsNp ? "font-np" : "", palette.subtext)}>
                {primary}
              </p>
            </div>

            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className={cn(
                "inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all h-9",
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
