"use client"

import { cn } from "@/lib/utils"
import { useTheme } from "@/components/theme-provider"

interface StatCardProps {
  title: string
  value: string
  note: string
}

export function StatCard({ title, value, note }: StatCardProps) {
  const { palette } = useTheme()

  return (
    <div className="flex flex-col min-w-0">
      <div className={cn("text-[10px] uppercase tracking-wide", palette.muted)}>{title}</div>
      <div className={cn("text-sm font-semibold truncate", palette.text)}>{value}</div>
      <div className={cn("text-[10px] truncate", palette.subtext)}>{note}</div>
    </div>
  )
}
