"use client";
import { useEffect, useMemo, useState } from "react";
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
  Timer,
} from "lucide-react";
import { BrandImage } from "@/components/brand-image";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider";
import { sourceRegistry } from "@/lib/source-registry";
import type { RangeKey } from "@/lib/news-pipeline";
import type { SourceStatusMeta } from "@/lib/news-pipeline";

interface AppSidebarProps {
  range: RangeKey;
  setRange: (value: RangeKey) => void;
  bucket: "all" | "national" | "international";
  setBucket: (value: "all" | "national" | "international") => void;
  sourceFilter: string | null;
  setSourceFilter: (id: string | null) => void;
  sourceStatuses: SourceStatusMeta[];
  compact?: boolean;
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
  const { palette, t } = useTheme();
  const [sourcesOpen, setSourcesOpen] = useState(true);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());

    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, []);

  const statusById = useMemo(
    () => Object.fromEntries(sourceStatuses.map((s) => [s.id, s])),
    [sourceStatuses],
  );

  const activeCounts = useMemo(() => {
    const national = sourceStatuses.filter(
      (s) => s.ok && sourceRegistry.national.some((src) => src.id === s.id),
    ).length;
    const international = sourceStatuses.filter(
      (s) =>
        s.ok && sourceRegistry.international.some((src) => src.id === s.id),
    ).length;

    return { national, international };
  }, [sourceStatuses]);

  const navItems = [
    {
      key: "today",
      label: t.navToday,
      icon: Newspaper,
      range: "day" as RangeKey,
    },
    {
      key: "week",
      label: t.navWeek,
      icon: CalendarDays,
      range: "week" as RangeKey,
    },
    {
      key: "month",
      label: t.navMonth,
      icon: LayoutDashboard,
      range: "month" as RangeKey,
    },
  ];

  const nationalSources = sourceRegistry.national;
  const internationalSources = sourceRegistry.international;

  function SourceRow({ source }: { source: (typeof nationalSources)[0] }) {
    const status = statusById[source.id];
    const isActive = source.active;
    const isSelected = sourceFilter === source.id;
    const hasError = isActive && status && !status.ok;
    const isLive = isActive && status?.ok;

    // Format last fetch age
    const fetchAge = useMemo(() => {
      if (!status?.fetchedAt || now === null) return null;
      const diffMin = Math.floor((now - status.fetchedAt) / 60_000);
      if (diffMin < 1) return "just now";
      if (diffMin === 1) return "1m ago";
      if (diffMin < 60) return `${diffMin}m ago`;
      return `${Math.floor(diffMin / 60)}h ago`;
    }, [now, status]);

    let statusIcon: React.ReactNode;
    if (!isActive) {
      statusIcon = <Circle className="h-2.5 w-2.5 shrink-0 opacity-55" />;
    } else if (!status) {
      statusIcon = <Circle className="h-2.5 w-2.5 shrink-0 opacity-40" />;
    } else if (isLive) {
      statusIcon = (
        <CheckCircle2 className="h-2.5 w-2.5 shrink-0 text-emerald-500" />
      );
    } else {
      statusIcon = (
        <AlertCircle className="h-2.5 w-2.5 shrink-0 text-red-400 opacity-80" />
      );
    }

    const handleClick = () => {
      if (!isActive) return;
      setSourceFilter(isSelected ? null : source.id);
    };

    return (
      <button
        onClick={handleClick}
        disabled={!isActive}
        aria-pressed={isSelected}
        title={
          !isActive
            ? `${source.name} — ${source.note} (no RSS configured)`
            : hasError
              ? `${source.name} — fetch error: ${status?.error ?? "unknown"}`
              : `${source.name} — ${source.note}${fetchAge ? ` • ${fetchAge}` : ""}`
        }
        className={cn(
          "group flex w-full items-center gap-2 px-2 py-1.5 text-xs rounded-sm transition-all",
          isActive
            ? isSelected
              ? palette.accent
              : cn("hover:bg-white/5", palette.text)
            : cn("cursor-not-allowed text-[11px] opacity-75", palette.muted),
        )}
      >
        {statusIcon}
        <span className="flex-1 truncate text-left leading-tight">
          {source.name}
        </span>
        {/* Language badge for NP sources */}
        {source.language === "np" && isActive && (
          <span
            className={cn("text-[9px] px-1 rounded opacity-60", palette.soft)}
          >
            NP
          </span>
        )}
        {isLive && status!.itemCount > 0 && (
          <span
            className={cn("text-[10px] tabular-nums opacity-50", palette.muted)}
          >
            {status!.itemCount}
          </span>
        )}
      </button>
    );
  }

  // Count active+ok sources total
  const liveSourceCount = sourceStatuses.filter((s) => s.ok).length;

  const content = (
    <div
      className={cn(
        "flex flex-col h-full gap-2 overflow-y-auto border backdrop-blur-lg",
        compact ? "border-none p-0 shadow-none" : "p-2.5 shadow-sm",
        palette.shell,
      )}
    >
      {/* Brand */}
      {!compact && (
        <BrandImage
          priority
          containerClassName="min-h-24 border-b border-white/10 pb-3"
          imageClassName="max-h-16 xl:max-h-[4.5rem]"
        />
      )}

      {/* Navigation */}
      <div className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = range === item.range;
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
          );
        })}
      </div>

      <Separator className="opacity-40" />

      {/* Area filter */}
      <div>
        <div
          className={cn(
            "mb-1.5 px-1 text-[10px] uppercase tracking-widest font-medium",
            palette.muted,
          )}
        >
          {t.feedLensLabel}
        </div>
        <div className="flex flex-col gap-1">
          {(
            [
              {
                id: "national",
                label: t.feedNational,
                icon: FlagTriangleRight,
                count: activeCounts.national,
              },
              {
                id: "international",
                label: t.feedInternational,
                icon: Globe,
                count: activeCounts.international,
              },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const active = bucket === item.id;

            return (
              <Button
                key={item.id}
                variant="outline"
                size="sm"
                onClick={() => {
                  setBucket(item.id);
                  setSourceFilter(null);
                }}
                aria-pressed={active}
                className={cn(
                  "h-9 w-full justify-start gap-2.5 rounded-md px-3 text-xs",
                  active ? palette.accent : palette.ghost,
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">{item.label}</span>
                {item.count > 0 && (
                  <span
                    className={cn(
                      "text-[10px] tabular-nums opacity-50",
                      active ? "" : palette.muted,
                    )}
                  >
                    {item.count}
                  </span>
                )}
              </Button>
            );
          })}
        </div>
      </div>

      <Separator className="opacity-40" />

      {/* Sources — collapsible */}
      <div className="pb-1 min-h-0">
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
              <span>{t.trustedSourcesTitle}</span>
              {liveSourceCount > 0 && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] leading-none font-semibold",
                    palette.badge,
                  )}
                >
                  {liveSourceCount} live
                </span>
              )}
              {sourceFilter && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] leading-none",
                    palette.accent,
                  )}
                >
                  filtered
                </span>
              )}
            </div>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 transition-transform duration-200",
                sourcesOpen && "rotate-180",
              )}
            />
          </div>
        </button>

        {sourcesOpen && (
          <div className="mt-1 space-y-2 pl-1">
            {sourceFilter && (
              <button
                onClick={() => setSourceFilter(null)}
                className={cn(
                  "text-[10px] px-2 py-0.5 underline underline-offset-2 hover:no-underline transition-colors",
                  palette.muted,
                )}
              >
                ✕ Clear filter
              </button>
            )}

            {/* National */}
            <div>
              <div
                className={cn(
                  "mb-1 px-2 text-[10px] uppercase tracking-widest font-medium",
                  palette.muted,
                )}
              >
                {t.sectionNepal}
              </div>
              <div className="space-y-0.5">
                {nationalSources.map((source) => (
                  <SourceRow key={source.id} source={source} />
                ))}
              </div>
            </div>

            {/* International */}
            <div>
              <div
                className={cn(
                  "mb-1 px-2 text-[10px] uppercase tracking-widest font-medium",
                  palette.muted,
                )}
              >
                {t.sectionInternational}
              </div>
              <div className="space-y-0.5">
                {internationalSources.map((source) => (
                  <SourceRow key={source.id} source={source} />
                ))}
              </div>
            </div>

            {/* Legend */}
            <div
              className={cn(
                "mt-1.5 space-y-1 px-2 pt-2 border-t",
                palette.muted,
              )}
            >
              <div className="flex items-center gap-1.5 text-[10px] opacity-60">
                <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500" />
                <span>Live — click to filter</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] opacity-60">
                <AlertCircle className="h-2.5 w-2.5 text-red-400" />
                <span>Fetch error — using last cache</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] opacity-40">
                <Circle className="h-2.5 w-2.5" />
                <span>No RSS — not available</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] opacity-50 pt-0.5">
                <Timer className="h-2.5 w-2.5" />
                <span>Feed refreshes every 5 minutes</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return content;
}
