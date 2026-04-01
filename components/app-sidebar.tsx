"use client"

import { useState } from "react"
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Circle,
  FlagTriangleRight,
  Globe,
  LayoutDashboard,
  Newspaper,
  Shield,
  BookOpenCheck,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { useTheme } from "@/components/theme-provider"
import { sourceRegistry } from "@/lib/source-registry"
import type { RangeKey } from "@/lib/news-pipeline"
import type { SourceStatusMeta } from "@/lib/news-pipeline"

interface AppSidebarProps {
  range: RangeKey
  setRange: (value: RangeKey) => void
  bucket: "all" | "national" | "international"
  setBucket: (value: "all" | "national" | "international") => void
  /** Currently active source filter (source id or null for all) */
  sourceFilter: string | null
  setSourceFilter: (id: string | null) => void
  /** Live fetch status from the most recent aggregation */
  sourceStatuses: SourceStatusMeta[]
  /** Compact mode for mobile sheet — omits brand header */
  compact?: boolean
}

export function AppSidebar({
  range,
  setRange,
  bucket,
  setBucket,
  sourceFilter,
  setSourceFilter,
  sourceStatuses,
  compact = false,
}: AppSidebarProps) {
  const { palette, t } = useTheme()
  const [sourcesOpen, setSourcesOpen] = useState(false)

  // Build a status lookup map keyed by source id
  const statusById = Object.fromEntries(sourceStatuses.map((s) => [s.id, s]))

  const navItems = [
    { key: "today", label: t.navToday, icon: Newspaper, range: "day" as RangeKey },
    { key: "week", label: t.navWeek, icon: CalendarDays, range: "week" as RangeKey },
    { key: "month", label: t.navMonth, icon: LayoutDashboard, range: "month" as RangeKey },
  ]

  const nationalSources = sourceRegistry.national
  const internationalSources = sourceRegistry.international

  function SourceRow({
    source,
  }: {
    source: (typeof nationalSources)[0]
  }) {
    const status = statusById[source.id]
    const isActive = source.active
    const isSelected = sourceFilter === source.id

    let statusIcon: React.ReactNode
    if (!isActive) {
      // Inactive — no RSS configured
      statusIcon = <Circle className="h-2.5 w-2.5 shrink-0 opacity-30" />
    } else if (!status) {
      // Active but not yet fetched
      statusIcon = <Circle className="h-2.5 w-2.5 shrink-0 opacity-50" />
    } else if (status.ok) {
      statusIcon = (
        <CheckCircle2 className={cn("h-2.5 w-2.5 shrink-0", "text-emerald-500")} />
      )
    } else {
      statusIcon = (
        <AlertCircle className={cn("h-2.5 w-2.5 shrink-0", "text-red-400 opacity-70")} />
      )
    }

    const handleClick = () => {
      if (!isActive) return
      setSourceFilter(isSelected ? null : source.id)
    }

    return (
      <button
        onClick={handleClick}
        disabled={!isActive}
        aria-pressed={isSelected}
        title={
          !isActive
            ? `${source.name} — ${source.note} (no RSS)`
            : status?.error
              ? `${source.name} — fetch error: ${status.error}`
              : source.note
        }
        className={cn(
          "flex w-full items-center gap-2 px-2 py-1 text-xs rounded-sm transition-all",
          isActive
            ? isSelected
              ? palette.accent
              : cn("hover:bg-white/5", palette.text)
            : cn("opacity-40 cursor-default", palette.muted),
        )}
      >
        {statusIcon}
        <span className="flex-1 truncate text-left">{source.name}</span>
        {status?.ok && status.itemCount > 0 && (
          <span className={cn("text-[10px] tabular-nums opacity-60", palette.muted)}>
            {status.itemCount}
          </span>
        )}
      </button>
    )
  }

  const content = (
    <div
      className={cn(
        "flex flex-col h-full gap-2 overflow-y-auto border p-2.5 shadow-sm backdrop-blur-lg",
        compact ? "border-none shadow-none p-0" : "",
        palette.shell,
      )}
    >
      {/* Brand — hidden in compact mode */}
      {!compact && (
        <>
          <div className="flex items-center gap-2.5 px-2 py-1">
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center border rounded-md shadow-sm transition-transform hover:scale-105",
                palette.soft,
              )}
            >
              <BookOpenCheck className="h-5 w-5" />
            </div>
            <div className="flex flex-col leading-tight">
              <div className={cn("text-base font-bold tracking-tight", palette.text)}>
                एक झलक
              </div>
              <p className={cn("text-sm opacity-70", palette.muted)}>
                सररर एक झलक न्युज पढ्नुहोस्
              </p>
            </div>
          </div>
          <Separator className="opacity-50" />
        </>
      )}

      {/* Navigation */}
      <div className="space-y-1.5">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = range === item.range
          return (
            <button
              key={item.key}
              onClick={() => setRange(item.range)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex w-full items-center gap-2.5 px-3 py-2 text-xs transition rounded-md",
                active ? palette.accent : palette.ghost,
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          )
        })}
      </div>

      <Separator className="opacity-50" />

      {/* Feed lens */}
      <div>
        <div className={cn("mb-1.5 px-1 text-xs uppercase tracking-wide", palette.muted)}>
          {t.feedLensLabel}
        </div>
        <div className="flex flex-col gap-1.5">
          {(
            [
              { id: "national", label: t.feedNational, icon: FlagTriangleRight },
              { id: "international", label: t.feedInternational, icon: Globe },
            ] as const
          ).map((item) => {
            const Icon = item.icon
            const active = bucket === item.id
            return (
              <Button
                key={item.id}
                variant="outline"
                size="sm"
                onClick={() => {
                  setBucket(item.id)
                  // Clear source filter when switching bucket
                  setSourceFilter(null)
                }}
                aria-pressed={active}
                className={cn(
                  "h-9 w-full justify-start px-3 text-xs rounded-md gap-2.5",
                  active ? palette.accent : palette.ghost,
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Button>
            )
          })}
        </div>
      </div>

      <Separator className="opacity-50" />

      {/* Sources — collapsible with live status */}
      <div className="pb-1">
        <button
          onClick={() => setSourcesOpen(!sourcesOpen)}
          aria-expanded={sourcesOpen}
          className="w-full"
        >
          <div
            className={cn(
              "flex w-full items-center justify-between px-3 py-2 text-xs font-medium transition rounded-md",
              palette.ghost,
            )}
          >
            <div className="flex items-center gap-2.5">
              <Shield className="h-3.5 w-3.5 shrink-0" />
              {t.trustedSourcesTitle}
              {sourceFilter && (
                <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] leading-none", palette.accent)}>
                  1
                </span>
              )}
            </div>
            <ChevronDown
              className={cn("h-3.5 w-3.5 transition-transform", sourcesOpen && "rotate-180")}
            />
          </div>
        </button>

        {sourcesOpen && (
          <div className="mt-1 space-y-2 pl-2">
            {/* Clear filter shortcut */}
            {sourceFilter && (
              <button
                onClick={() => setSourceFilter(null)}
                className={cn("text-[10px] px-2 py-0.5 underline underline-offset-2 hover:no-underline", palette.muted)}
              >
                Clear source filter
              </button>
            )}

            {/* National sources */}
            <div>
              <div className={cn("mb-1 text-[10px] uppercase tracking-wide px-2", palette.muted)}>
                {t.sectionNepal}
              </div>
              <div className="space-y-0.5">
                {nationalSources.map((source) => (
                  <SourceRow key={source.id} source={source} />
                ))}
              </div>
            </div>

            {/* International sources */}
            <div>
              <div className={cn("mb-1 text-[10px] uppercase tracking-wide px-2", palette.muted)}>
                {t.sectionInternational}
              </div>
              <div className="space-y-0.5">
                {internationalSources.map((source) => (
                  <SourceRow key={source.id} source={source} />
                ))}
              </div>
            </div>

            {/* Legend */}
            <div className={cn("mt-2 space-y-1 px-2 pt-1 border-t opacity-60", palette.muted)}>
              <div className="flex items-center gap-1.5 text-[10px]">
                <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500" />
                <span>Live — click to filter by source</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px]">
                <AlertCircle className="h-2.5 w-2.5 text-red-400" />
                <span>Fetch error — using cache if available</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px]">
                <Circle className="h-2.5 w-2.5 opacity-30" />
                <span>No RSS available</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  return content
}
