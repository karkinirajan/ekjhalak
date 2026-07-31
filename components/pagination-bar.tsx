"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
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
  const { t, language } = useTheme();
  const safeTotal = Math.max(totalPages, 1);
  const pageWindow = buildPageWindow(page, safeTotal);
  const isNp = language === "np";

  if (safeTotal <= 1) return null;

  const arrowClass =
    "flex h-9 w-9 items-center justify-center rounded-full border border-rule text-ink-muted transition-colors hover:border-rule-strong hover:text-ink disabled:pointer-events-none disabled:opacity-35";

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-4 border-t border-rule pt-6"
    >
      <p
        className={cn(
          "eyebrow tabular-nums text-ink-muted",
          isNp && "font-np tracking-normal",
        )}
      >
        {t.pagePre} <span className="text-ink">{page}</span> {t.pageOf}{" "}
        <span className="text-ink">{safeTotal}</span>
      </p>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          aria-label={t.prev}
          className={arrowClass}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>

        {pageWindow.map((entry, index) =>
          entry === "…" ? (
            <span
              key={`gap-${index}`}
              aria-hidden="true"
              className="flex h-9 w-6 items-center justify-center text-sm text-ink-muted select-none"
            >
              …
            </span>
          ) : (
            <button
              key={entry}
              type="button"
              onClick={() => onPageChange(entry)}
              aria-label={`${t.pagePre} ${entry}`}
              aria-current={entry === page ? "page" : undefined}
              className={cn(
                "flex h-9 min-w-9 items-center justify-center rounded-full px-2 text-sm font-semibold tabular-nums transition-colors",
                entry === page
                  ? "bg-ink text-canvas"
                  : "text-ink-muted hover:bg-raised hover:text-ink",
              )}
            >
              {entry}
            </button>
          ),
        )}

        <button
          type="button"
          onClick={() => onPageChange(Math.min(safeTotal, page + 1))}
          disabled={page >= safeTotal}
          aria-label={t.next}
          className={arrowClass}
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
