"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider";

interface PaginationBarProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

/**
 * Produces a window of up to 7 page numbers around the current page,
 * with ellipsis markers where gaps occur.
 * Example for page 5 of 12: [1, '…', 4, 5, 6, '…', 12]
 */
function buildPageWindow(current: number, total: number): (number | "…")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | "…")[] = [];
  const WING = 1; // pages on each side of current

  const showLeft = current > 2 + WING;
  const showRight = current < total - 1 - WING;

  pages.push(1);
  if (showLeft) pages.push("…");

  const start = Math.max(2, current - WING);
  const end = Math.min(total - 1, current + WING);
  for (let i = start; i <= end; i++) pages.push(i);

  if (showRight) pages.push("…");
  pages.push(total);

  return pages;
}

export function PaginationBar({
  page,
  totalPages,
  onPageChange,
}: PaginationBarProps) {
  const { palette, t } = useTheme();
  const safeTotal = Math.max(totalPages, 1);
  const pageWindow = buildPageWindow(page, safeTotal);

  // Only render if there is more than one page
  if (safeTotal <= 1) return null;

  return (
    <nav
      aria-label="Pagination"
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2",
        palette.panel,
      )}
    >
      <div className={cn("text-xs tabular-nums", palette.muted)}>
        {t.pagePre}{" "}
        <span className={cn("font-semibold", palette.text)}>{page}</span>{" "}
        {t.pageOf}{" "}
        <span className={cn("font-semibold", palette.text)}>{safeTotal}</span>
      </div>

      <div
        className="flex items-center gap-1"
        role="group"
        aria-label="Page navigation"
      >
        {/* Previous */}
        <Button
          variant="outline"
          size="icon-xs"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className={cn("rounded-md", palette.ghost)}
          aria-label={t.prev}
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>

        {/* Page number buttons */}
        {pageWindow.map((entry, idx) =>
          entry === "…" ? (
            <span
              key={`ellipsis-${idx}`}
              className={cn(
                "flex h-6 w-6 items-center justify-center text-xs select-none",
                palette.muted,
              )}
              aria-hidden="true"
            >
              …
            </span>
          ) : (
            <Button
              key={entry}
              variant="outline"
              size="icon-xs"
              onClick={() => onPageChange(entry)}
              aria-label={`${t.pagePre} ${entry}`}
              aria-current={entry === page ? "page" : undefined}
              className={cn(
                "h-6 w-6 rounded-md text-xs",
                entry === page ? palette.accent : palette.ghost,
              )}
            >
              {entry}
            </Button>
          ),
        )}

        {/* Next */}
        <Button
          variant="outline"
          size="icon-xs"
          onClick={() => onPageChange(Math.min(safeTotal, page + 1))}
          disabled={page >= safeTotal}
          className={cn("rounded-md", palette.ghost)}
          aria-label={t.next}
        >
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
