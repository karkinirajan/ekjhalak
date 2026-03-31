"use client"

import {
  BadgeCheck,
  CalendarDays,
  Home,
  LayoutDashboard,
  Newspaper,
  Settings2,
  Shield,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { useTheme } from "@/components/theme-provider"
import { sourceRegistry, researchStack, LOCAL_TIMEZONE } from "@/lib/news-sources"
import type { RangeKey } from "@/lib/news-pipeline"

interface AppSidebarProps {
  range: RangeKey
  setRange: (value: RangeKey) => void
  bucket: "all" | "national" | "international"
  setBucket: (value: "all" | "national" | "international") => void
  status: string
}

export function AppSidebar({ range, setRange, bucket, setBucket, status }: AppSidebarProps) {
  const { palette, language, t } = useTheme()

  const navItems = [
    { key: "today", label: t.navToday, icon: Newspaper, range: "day" as RangeKey },
    { key: "week", label: t.navWeek, icon: CalendarDays, range: "week" as RangeKey },
    { key: "month", label: t.navMonth, icon: LayoutDashboard, range: "month" as RangeKey },
  ]

  return (
    <div
      className={cn(
        "sticky top-[61px] flex max-h-[calc(100vh-61px)] flex-col gap-3 overflow-y-auto rounded-[24px] border p-3 shadow-xl backdrop-blur-xl",
        palette.shell
      )}
    >
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-1 pt-1">
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border", palette.soft)}>
          <Newspaper className="h-4 w-4" />
        </div>
        <div>
          <div className={cn("text-sm font-semibold", palette.text)}>ClutterFree News</div>
          <div className={cn("text-xs", palette.muted)}>{t.appTagline}</div>
        </div>
      </div>

      <Separator className="opacity-50" />

      {/* Navigation */}
      <div className="space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = range === item.range
          return (
            <button
              key={item.key}
              onClick={() => setRange(item.range)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition",
                active ? palette.accent : palette.ghost
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </button>
          )
        })}
      </div>

      <Separator className="opacity-50" />

      {/* Feed lens */}
      <div>
        <div className={cn("mb-2 px-1 text-xs uppercase tracking-[0.2em]", palette.muted)}>
          {t.feedLensLabel}
        </div>
        <div className="grid gap-1.5">
          {(
            [
              { id: "all", label: t.feedAll },
              { id: "national", label: t.feedNational },
              { id: "international", label: t.feedInternational },
            ] as const
          ).map((item) => (
            <Button
              key={item.id}
              variant="ghost"
              onClick={() => setBucket(item.id)}
              className={cn(
                "h-9 justify-start rounded-xl border text-sm",
                bucket === item.id ? palette.accent : palette.ghost
              )}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </div>

      <Separator className="opacity-50" />

      {/* Trusted sources */}
      <div>
        <div className={cn("mb-2 flex items-center gap-1.5 px-1 text-sm font-medium", palette.text)}>
          <Shield className="h-3.5 w-3.5" />
          {t.trustedSourcesTitle}
        </div>
        <div className={cn("mb-2 px-1 text-xs", palette.muted)}>{t.trustedSourcesDesc}</div>
        <div className="space-y-3">
          <div>
            <div className={cn("mb-1.5 px-1 text-xs uppercase tracking-[0.18em]", palette.muted)}>
              {t.sectionNepal}
            </div>
            <div className="space-y-1">
              {sourceRegistry.national.map((source) => (
                <a
                  key={source.name}
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className={cn("block rounded-xl border px-2.5 py-2 transition", palette.card)}
                >
                  <div className={cn("text-xs font-medium", palette.text)}>{source.name}</div>
                  <div className={cn("text-xs", palette.muted)}>{source.note}</div>
                </a>
              ))}
            </div>
          </div>
          <div>
            <div className={cn("mb-1.5 px-1 text-xs uppercase tracking-[0.18em]", palette.muted)}>
              {t.sectionWorld}
            </div>
            <div className="space-y-1">
              {sourceRegistry.international.map((source) => (
                <a
                  key={source.name}
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className={cn("block rounded-xl border px-2.5 py-2 transition", palette.card)}
                >
                  <div className={cn("text-xs font-medium", palette.text)}>{source.name}</div>
                  <div className={cn("text-xs", palette.muted)}>{source.note}</div>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Separator className="opacity-50" />

      {/* Research stack */}
      <div>
        <div className={cn("mb-2 flex items-center gap-1.5 px-1 text-sm font-medium", palette.text)}>
          <BadgeCheck className="h-3.5 w-3.5" />
          {t.researchStackTitle}
        </div>
        <div className={cn("mb-2 px-1 text-xs", palette.muted)}>{t.researchStackDesc}</div>
        <div className="space-y-1">
          {researchStack.map((item) => (
            <div key={item.name} className={cn("rounded-xl border px-2.5 py-2", palette.panel)}>
              <div className={cn("text-xs font-medium", palette.text)}>{item.name}</div>
              <div className={cn("text-xs", palette.subtext)}>
                {language === "np" ? item.roleNp : item.role}
              </div>
              <div className={cn("text-xs", palette.muted)}>
                {language === "np" ? item.noteNp : item.note}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Separator className="opacity-50" />

      {/* API contract */}
      <div className="pb-2">
        <div className={cn("mb-2 flex items-center gap-1.5 px-1 text-sm font-medium", palette.text)}>
          <Settings2 className="h-3.5 w-3.5" />
          {t.apiContractTitle}
        </div>
        <div className={cn("mb-2 px-1 text-xs", palette.muted)}>{t.apiContractDesc}</div>
        <div
          className={cn(
            "rounded-xl border px-2.5 py-2 font-mono text-xs leading-5",
            palette.panel,
            palette.subtext
          )}
        >
          GET /api/news
          <br />
          ?range=day|week|month
          <br />
          &amp;bucket=all|national|intl
          <br />
          &amp;limit=100&amp;lang=en|np
          <br />
          <span className={palette.muted}>refresh: 21:00 {LOCAL_TIMEZONE}</span>
        </div>
        <p className={cn("mt-2 px-1 text-xs leading-5", palette.muted)}>{status}</p>
      </div>
    </div>
  )
}
