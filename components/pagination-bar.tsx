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
    <div className={cn("flex flex-wrap items-center justify-between gap-3 rounded-3xl border px-4 py-3", palette.panel)}>
      <div className={cn("text-sm", palette.muted)}>
        {t.pagePre}{" "}
        <span className={cn("font-semibold", palette.text)}>{page}</span>{" "}
        {t.pageOf}{" "}
        <span className={cn("font-semibold", palette.text)}>{safeTotal}</span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className={cn("rounded-2xl", palette.ghost)}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          {t.prev}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(Math.min(safeTotal, page + 1))}
          disabled={page >= safeTotal}
          className={cn("rounded-2xl", palette.ghost)}
        >
          {t.next}
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
