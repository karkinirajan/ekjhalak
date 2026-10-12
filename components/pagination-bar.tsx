"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSite } from "@/components/site-provider";

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
  const { t, language } = useSite();
  const safeTotal = Math.max(totalPages, 1);
  const pageWindow = buildPageWindow(page, safeTotal);
  const isNp = language === "np";

  if (safeTotal <= 1) return null;

  const arrowClass =
    "flex h-11 w-11 items-center justify-center rounded-md border border-rule text-ink-muted transition-colors hover:border-rule-strong hover:text-ink disabled:pointer-events-none disabled:opacity-35";

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

      {/* 44px targets push the full 9-slot window (7 pages + 2 arrows) past
          a 375px viewport, so this row scrolls horizontally rather than
          wrapping or clipping — same pattern as the topic rail in
          category-nav.tsx. */}
      <div className="flex max-w-full items-center gap-1.5 overflow-x-auto scrollbar-none">
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
              className="flex h-11 w-6 items-center justify-center text-sm text-ink-muted select-none"
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
                "flex h-11 min-w-11 items-center justify-center rounded-md px-2 text-sm font-semibold tabular-nums transition-colors",
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
