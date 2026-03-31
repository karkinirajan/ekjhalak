"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useTheme } from "@/components/theme-provider"

interface PaginationBarProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

export function PaginationBar({ page, totalPages, onPageChange }: PaginationBarProps) {
  const { palette, t } = useTheme()
  const safeTotal = Math.max(totalPages, 1)

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2", palette.panel)}>
      <div className={cn("text-xs", palette.muted)}>
        {t.pagePre}{" "}
        <span className={cn("font-semibold", palette.text)}>{page}</span>{" "}
        {t.pageOf}{" "}
        <span className={cn("font-semibold", palette.text)}>{safeTotal}</span>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-xs"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className={cn("rounded-md", palette.ghost)}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="icon-xs"
          onClick={() => onPageChange(Math.min(safeTotal, page + 1))}
          disabled={page >= safeTotal}
          className={cn("rounded-md", palette.ghost)}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
