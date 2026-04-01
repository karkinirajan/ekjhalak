"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Languages, Menu, MoonStar, Newspaper, RefreshCw, Search, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { useTheme } from "@/components/theme-provider"
import { AppSidebar } from "@/components/app-sidebar"
import { NewsCard } from "@/components/news-card"
import { PaginationBar } from "@/components/pagination-bar"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"

import type { NewsItem, NewsFeedResponse, RangeKey } from "@/lib/news-pipeline"

const PAGE_SIZE = 20
const REFRESH_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

type LoadState = "idle" | "loading" | "refreshing" | "error"

export default function ClutterFreeNewsPage() {
  const { palette, language, setLanguage, t, themeMode, setThemeMode } = useTheme()

  const [range, setRange] = useState<RangeKey>("day")
  const [bucket, setBucket] = useState<"all" | "national" | "international">("all")
  const [sourceFilter, setSourceFilter] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const [items, setItems] = useState<NewsItem[]>([])
  const [meta, setMeta] = useState<NewsFeedResponse["meta"] | null>(null)
  const [loadState, setLoadState] = useState<LoadState>("idle")
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null)

  // Track whether we have ever loaded data successfully
  const hasData = useRef(false)

  // ── Fetch feed from API ──────────────────────────────────────────────────

  const fetchFeed = useCallback(
    async (isBackground = false) => {
      if (!isBackground) {
        setLoadState(hasData.current ? "refreshing" : "loading")
      }

      try {
        const url = `/api/news?range=${range}&bucket=${bucket}&limit=200`
        const res = await fetch(url, {
          // Always get fresh data from the server (server handles its own 10-min cache)
          cache: "no-store",
        })

        if (!res.ok) throw new Error(`HTTP ${res.status}`)

        const data: NewsFeedResponse = await res.json()
        setItems(data.items)
        setMeta(data.meta)
        setLastFetchedAt(Date.now())
        hasData.current = true
        setLoadState("idle")
      } catch (err) {
        console.error("[page] fetchFeed error:", err)
        if (!hasData.current) setLoadState("error")
        else setLoadState("idle") // Keep showing stale data on background refresh failure
      }
    },
    [range, bucket]
  )

  // Fetch when range or bucket changes
  useEffect(() => {
    hasData.current = false
    fetchFeed(false)
  }, [fetchFeed])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [range, bucket, sourceFilter, language, search])

  // Auto-refresh every 5 minutes (background — doesn't show loading state)
  useEffect(() => {
    const id = setInterval(() => fetchFeed(true), REFRESH_INTERVAL_MS)
    return () => clearInterval(id)
  }, [fetchFeed])

  // Document title
  useEffect(() => {
    const titleSuffix = language === "np" ? "स्वदेश र विदेश" : "National & International"
    document.title = `एक झलक — ${titleSuffix}`
  }, [language])

  // ── Filter + search (client-side, applied after API filtering) ────────────

  const filteredItems = useMemo(() => {
    let result = items

    if (sourceFilter) {
      result = result.filter((item) => item.sourceId === sourceFilter)
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((item) =>
        [item.title, item.source, item.summaryEn, item.summaryNp]
          .join(" ")
          .toLowerCase()
          .includes(q)
      )
    }

    return result
  }, [items, sourceFilter, search])

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paginatedItems = filteredItems.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const rangeLabel = range === "day" ? t.rangeDay : range === "week" ? t.rangeWeek : t.rangeMonth

  // ── Last updated label ───────────────────────────────────────────────────

  const lastUpdatedLabel = useMemo(() => {
    if (!lastFetchedAt) return null
    const diffMin = Math.floor((Date.now() - lastFetchedAt) / 60_000)
    if (diffMin < 1) return "Just now"
    if (diffMin === 1) return "1 min ago"
    return `${diffMin} min ago`
  }, [lastFetchedAt])

  // ── Skeleton ─────────────────────────────────────────────────────────────

  const SkeletonCard = () => (
    <div className={cn("border rounded-md p-4 space-y-2 animate-pulse", palette.card)}>
      <div className="flex gap-2">
        <div className={cn("h-4 w-16 rounded", palette.soft)} />
        <div className={cn("h-4 w-24 rounded", palette.soft)} />
      </div>
      <div className={cn("h-4 w-3/4 rounded", palette.soft)} />
      <div className={cn("h-3 w-full rounded", palette.soft)} />
      <div className={cn("h-3 w-5/6 rounded", palette.soft)} />
    </div>
  )

  return (
    <div className={cn("min-h-screen bg-gradient-to-br flex", palette.app, palette.page)}>
      {/* Sidebar */}
      <aside className="hidden w-[260px] shrink-0 lg:flex flex-col fixed left-0 top-0 h-screen z-40">
        <AppSidebar
          range={range}
          setRange={setRange}
          bucket={bucket}
          setBucket={setBucket}
          sourceFilter={sourceFilter}
          setSourceFilter={setSourceFilter}
          sourceStatuses={meta?.sourceStatuses ?? []}
        />
      </aside>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col lg:ml-[260px]">
        <div className="flex min-w-0 flex-1 flex-col gap-3 p-2 pt-0 lg:p-3 lg:pt-0 overflow-y-auto">

          {/* News feed card */}
          <Card className={cn("border rounded-md", palette.shell)}>
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex flex-col gap-3">
                {/* Top bar: search + controls */}
                <div className="flex items-center gap-2 justify-end w-full">
                  <div className="relative flex-1 min-w-0">
                    <Search className={cn("absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2", palette.muted)} />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder={t.searchPlaceholder}
                      className={cn("h-8 pl-9 text-sm w-full rounded-md", palette.input)}
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => fetchFeed(false)}
                    disabled={loadState === "loading" || loadState === "refreshing"}
                    className={cn("shrink-0 rounded-md", palette.ghost)}
                    aria-label="Refresh feed"
                  >
                    <RefreshCw
                      className={cn(
                        "h-4 w-4",
                        (loadState === "loading" || loadState === "refreshing") && "animate-spin"
                      )}
                    />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => setThemeMode(themeMode === "dark" ? "light" : "dark")}
                    className={cn("shrink-0 rounded-md", palette.ghost)}
                    aria-label={themeMode === "dark" ? t.themeLight : t.themeDark}
                  >
                    {themeMode === "dark" ? <Sun className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLanguage(language === "en" ? "np" : "en")}
                    className={cn("shrink-0 hidden sm:flex h-8", palette.ghost)}
                  >
                    <Languages className="mr-1.5 h-4 w-4" />
                    {t.langButton}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => setMobileMenuOpen(true)}
                    className={cn("shrink-0 rounded-md lg:hidden", palette.ghost)}
                    aria-label="Open navigation menu"
                  >
                    <Menu className="h-4 w-4" />
                  </Button>
                </div>

                {/* Header row: title + stats */}
                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                  <div>
                    <CardTitle className={cn("text-lg font-semibold", palette.text)}>
                      {rangeLabel} {t.rangeSuffix}
                    </CardTitle>
                    <CardDescription className={cn("text-sm mt-0.5", palette.muted)}>
                      {t.briefingDesc}
                    </CardDescription>
                  </div>

                  <div className={cn("flex items-center gap-6 border-l pl-6 md:border-l-0 md:pl-0 flex-wrap", palette.muted)}>
                    <div className="flex flex-col">
                      <div className="text-sm uppercase tracking-wide opacity-70 font-medium">{t.statItemsTitle}</div>
                      <div className={cn("text-sm font-medium tabular-nums", palette.text)}>{filteredItems.length}</div>
                    </div>
                    <div className="h-6 w-px bg-border opacity-50" />
                    <div className="flex flex-col">
                      <div className="text-sm uppercase tracking-wide opacity-70 font-medium">{t.statTimelineTitle}</div>
                      <div className={cn("text-sm font-medium", palette.text)}>{rangeLabel}</div>
                    </div>
                    <div className="h-6 w-px bg-border opacity-50" />
                    <div className="flex flex-col">
                      <div className="text-sm uppercase tracking-wide opacity-70 font-medium">{t.statFeedTitle}</div>
                      <div className={cn("text-sm font-medium", palette.text)}>
                        {bucket === "national" ? t.sectionNepal : bucket === "international" ? t.sectionInternational : t.feedAll}
                      </div>
                    </div>
                    {lastUpdatedLabel && (
                      <>
                        <div className="h-6 w-px bg-border opacity-50" />
                        <div className="flex flex-col">
                          <div className="text-sm uppercase tracking-wide opacity-70 font-medium">Updated</div>
                          <div className={cn("text-sm font-medium tabular-nums", palette.text)}>{lastUpdatedLabel}</div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Active source filter indicator */}
                {sourceFilter && (
                  <div className={cn("flex items-center gap-2 text-xs", palette.muted)}>
                    <span>Filtered by source:</span>
                    <span className={cn("font-medium", palette.text)}>
                      {items.find((i) => i.sourceId === sourceFilter)?.source ?? sourceFilter}
                    </span>
                    <button
                      onClick={() => setSourceFilter(null)}
                      className={cn("underline underline-offset-2 hover:no-underline", palette.muted)}
                      aria-label="Clear source filter"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-2 px-4 pb-4">
              {/* Loading skeleton */}
              {loadState === "loading" && (
                <div className="space-y-2" aria-label="Loading news feed" aria-busy="true">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <SkeletonCard key={i} />
                  ))}
                </div>
              )}

              {/* Error state */}
              {loadState === "error" && (
                <div
                  className={cn(
                    "border border-dashed p-6 text-center text-sm rounded-md space-y-3",
                    palette.panel,
                    palette.muted
                  )}
                  role="alert"
                >
                  <p>Could not load news feed. Check your connection or try again.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchFeed(false)}
                    className={cn("rounded-md", palette.ghost)}
                  >
                    Retry
                  </Button>
                </div>
              )}

              {/* Feed items */}
              {loadState !== "loading" && loadState !== "error" && (
                <>
                  {paginatedItems.length > 0 ? (
                    paginatedItems.map((item) => (
                      <NewsCard key={item.id} item={item} />
                    ))
                  ) : (
                    <div
                      className={cn(
                        "border border-dashed p-6 text-center text-sm rounded-md",
                        palette.panel,
                        palette.muted
                      )}
                      role="status"
                    >
                      {hasData.current
                        ? t.noStories
                        : "Loading stories…"}
                    </div>
                  )}
                  <PaginationBar page={safePage} totalPages={totalPages} onPageChange={setPage} />
                </>
              )}
            </CardContent>
          </Card>

          {/* Footer */}
          <footer className={cn("border px-4 py-4 text-xs mt-auto rounded-md", palette.panel)}>
            <div className="flex items-center justify-center gap-6">
              <div className={cn("flex items-center gap-1.5", palette.muted)}>
                <span>© {new Date().getFullYear()} एक झलक</span>
              </div>
              <div className={cn("flex items-center gap-1.5", palette.subtext)}>
                <span>Developed by</span>
                <a
                  href="https://kneeraazon.com"
                  target="_blank"
                  rel="noreferrer"
                  className={cn("font-medium hover:underline", palette.text)}
                >
                  Nirajan Karki
                </a>
              </div>
            </div>
          </footer>
        </div>
      </div>

      {/* Mobile menu sheet */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className={cn("w-[280px] p-0", palette.shell)}>
          <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
          <div className={cn("flex flex-col h-full overflow-y-auto p-4 gap-3", palette.shell)}>
            {/* Brand */}
            <div className="flex items-center gap-2">
              <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center border rounded-md", palette.soft)}>
                <Newspaper className="h-4 w-4" />
              </div>
              <div>
                <div className={cn("text-sm font-semibold", palette.text)}>एक झलक</div>
                <div className={cn("text-xs", palette.muted)}>{t.appTagline}</div>
              </div>
            </div>

            <Separator className="opacity-50" />

            {/* Language toggle */}
            <div>
              <div className={cn("mb-2 text-xs uppercase tracking-wide", palette.muted)}>{t.statLangTitle}</div>
              <div className="grid grid-cols-2 gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setLanguage("en"); setMobileMenuOpen(false) }}
                  className={cn("h-9 text-xs rounded-md", language === "en" ? palette.accent : palette.ghost)}
                >
                  {t.tabEnFirst}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setLanguage("np"); setMobileMenuOpen(false) }}
                  className={cn("h-9 text-xs rounded-md", language === "np" ? palette.accent : palette.ghost)}
                >
                  {t.tabNpFirst}
                </Button>
              </div>
            </div>

            <Separator className="opacity-50" />

            {/* Inline sidebar for mobile */}
            <AppSidebar
              range={range}
              setRange={(r) => { setRange(r); setMobileMenuOpen(false) }}
              bucket={bucket}
              setBucket={(b) => { setBucket(b); setMobileMenuOpen(false) }}
              sourceFilter={sourceFilter}
              setSourceFilter={(s) => { setSourceFilter(s); setMobileMenuOpen(false) }}
              sourceStatuses={meta?.sourceStatuses ?? []}
              compact
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
