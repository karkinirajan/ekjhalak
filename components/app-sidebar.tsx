"use client";

import { useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  LayoutDashboard,
  Newspaper,
  Shield,
  BookOpenCheck,
  FlagTriangleRight,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider";
import {
  sourceRegistry,
} from "@/lib/news-sources";
import type { RangeKey } from "@/lib/news-pipeline";

interface AppSidebarProps {
  range: RangeKey;
  setRange: (value: RangeKey) => void;
  bucket: "all" | "national" | "international";
  setBucket: (value: "all" | "national" | "international") => void;
}

export function AppSidebar({
  range,
  setRange,
  bucket,
  setBucket,
}: AppSidebarProps) {
  const { palette, language, t } = useTheme();
  const [sourcesOpen, setSourcesOpen] = useState(false);

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

  return (
    <div
      className={cn(
        "flex flex-col h-full gap-2 overflow-y-auto border p-2.5 shadow-sm backdrop-blur-lg",
        palette.shell,
      )}
    >
      {/* Brand */}
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
          <p className={cn("text-sm opacity-70", palette.muted)}>सररर एक झलक न्युज पढ्नुहोस्</p>
        </div>
      </div>

      <Separator className="opacity-50" />

      {/* Navigation */}
      <div className="space-y-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = range === item.range;
          return (
            <button
              key={item.key}
              onClick={() => setRange(item.range)}
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

      <Separator className="opacity-50" />

      {/* Feed lens */}
      <div>
        <div
          className={cn(
            "mb-1.5 px-1 text-xs uppercase tracking-wide",
            palette.muted,
          )}
        >
          {t.feedLensLabel}
        </div>
        <div className="flex flex-col gap-1.5">
          {(
            [
              { id: "national", label: t.feedNational, icon: FlagTriangleRight },
              { id: "international", label: t.feedInternational, icon: Globe },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            return (
              <Button
                key={item.id}
                variant="outline"
                size="sm"
                onClick={() => setBucket(item.id)}
                className={cn(
                  "h-9 w-full justify-start px-3 text-xs rounded-md gap-2.5",
                  bucket === item.id ? palette.accent : palette.ghost,
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Button>
            );
          })}
        </div>
      </div>

      <Separator className="opacity-50" />

      {/* Trusted sources - Dropdown */}
      <div className="pb-1">
        <button
          onClick={() => setSourcesOpen(!sourcesOpen)}
        >
          <div className={cn(
            "flex w-full items-center justify-between px-3 py-2 text-xs font-medium transition rounded-md",
            palette.ghost,
          )}>
            <div className="flex items-center gap-2.5">
              <Shield className="h-3.5 w-3.5 shrink-0" />
              {t.trustedSourcesTitle}
            </div>
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", sourcesOpen && "rotate-180")} />
          </div>
        </button>
        
        {sourcesOpen && (
          <div className="mt-1 space-y-2 pl-2">
            <div>
              <div className={cn("mb-1 text-[10px] uppercase tracking-wide", palette.muted)}>
                {t.sectionNepal}
              </div>
              <div className="space-y-0.5">
                {sourceRegistry.national.map((source) => (
                  <div
                    key={source.name}
                    className={cn(
                      "px-2 py-1 text-xs rounded-sm",
                      palette.soft,
                      palette.text,
                    )}
                  >
                    {source.name}
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className={cn("mb-1 text-[10px] uppercase tracking-wide", palette.muted)}>
                {t.sectionInternational}
              </div>
              <div className="space-y-0.5">
                {sourceRegistry.international.map((source) => (
                  <div
                    key={source.name}
                    className={cn(
                      "px-2 py-1 text-xs rounded-sm",
                      palette.soft,
                      palette.text,
                    )}
                  >
                    {source.name}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
