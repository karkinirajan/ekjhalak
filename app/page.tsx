"use client"

import { useEffect, useMemo, useState } from "react"
import { Languages, MoonStar, Search, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { useTheme } from "@/components/theme-provider"
import { AppSidebar } from "@/components/app-sidebar"
import { NewsCard } from "@/components/news-card"
import { StatCard } from "@/components/stat-card"
import { PaginationBar } from "@/components/pagination-bar"
import { demoData, type RangeKey } from "@/lib/news-pipeline"

const PAGE_SIZE = 20

type StatusKey = "demo" | "loading" | "connected" | "unavailable"

export default function ClutterFreeNewsPage() {
  const { palette, language, setLanguage, t, themeMode, setThemeMode } = useTheme()
  const [range, setRange] = useState<RangeKey>("day")
  const [bucket, setBucket] = useState<"all" | "national" | "international">("all")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [dataMode] = useState<"demo" | "live">("demo")
  const [liveItems, setLiveItems] = useState<Record<string, unknown[]>>({})
  const [statusKey, setStatusKey] = useState<StatusKey>("demo")

  useEffect(() => {
    setPage(1)
  }, [range, bucket, language, search])

  useEffect(() => {
    if (dataMode !== "live") return
    let ignore = false
    const controller = new AbortController()
    async function fetchLiveData() {
      try {
        setStatusKey("loading")
        const selectedBucket = bucket === "all" ? "all" : bucket
        const response = await fetch(
          `/api/news?range=${range}&bucket=${selectedBucket}&limit=100&lang=${language}`,
          { signal: controller.signal }
        )
        if (!response.ok) throw new Error("unavailable")
        const payload = await response.json()
        if (!ignore) {
          setLiveItems((prev) => ({
            ...prev,
            [`${range}-${selectedBucket}-${language}`]: (payload as { items?: unknown[] }).items ?? [],
          }))
          setStatusKey("connected")
        }
      } catch {
        if (!ignore) setStatusKey("unavailable")
      }
    }
    fetchLiveData()
    return () => { ignore = true; controller.abort() }
  }, [bucket, dataMode, language, range])

  const rangeLabel = range === "day" ? t.rangeDay : range === "week" ? t.rangeWeek : t.rangeMonth

  const items = useMemo(() => {
    const current = demoData[range]
    const merged =
      bucket === "all"
        ? [...current.national, ...current.international]
        : current[bucket]
    const sorted = [...merged].sort((a, b) => a.title.localeCompare(b.title))

    const selectedBucket = bucket === "all" ? "all" : bucket
    const liveKey = `${range}-${selectedBucket}-${language}`
    const maybeLive = liveItems[liveKey]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const source = dataMode === "live" && Array.isArray(maybeLive) && maybeLive.length > 0 ? (maybeLive as any[]) : sorted

    return source.filter((item) =>
      [item.title, item.source, item.summaryEn, item.summaryNp]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase())
    )
  }, [bucket, dataMode, language, liveItems, range, search])

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paginatedItems = items.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const feedValue =
    bucket === "all" ? t.feedValueAll
    : bucket === "national" ? t.feedValueNational
    : t.feedValueInternational

  const statusMessages: Record<StatusKey, string> = {
    demo: t.statusDemo,
    loading: t.statusLoading,
    connected: t.statusConnected,
    unavailable: t.statusUnavailable,
  }

  return (
    <div className={cn("min-h-screen bg-gradient-to-br", palette.app, palette.page)}>
      {/* Navbar */}
      <header className={cn("sticky top-0 z-30 border-b backdrop-blur-xl", palette.shell)}>
        <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-4 py-2.5 lg:px-6">
          <div className="relative flex-1">
            <Search className={cn("absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2", palette.muted)} />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.searchPlaceholder}
              className={cn("h-10 rounded-xl pl-10", palette.input)}
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setThemeMode(themeMode === "dark" ? "light" : "dark")}
            className={cn("shrink-0 rounded-xl", palette.ghost)}
            aria-label={themeMode === "dark" ? t.themeLight : t.themeDark}
          >
            {themeMode === "dark" ? <Sun className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            onClick={() => setLanguage(language === "en" ? "np" : "en")}
            className={cn("shrink-0 rounded-xl", palette.ghost)}
          >
            <Languages className="mr-2 h-4 w-4" />
            {t.langButton}
          </Button>
        </div>
      </header>

      {/* Page body */}
      <div className="mx-auto flex max-w-[1600px] gap-4 p-3 lg:p-4">
        {/* Sidebar */}
        <aside className="hidden w-[260px] shrink-0 lg:block">
          <AppSidebar
            range={range}
            setRange={setRange}
            bucket={bucket}
            setBucket={setBucket}
            status={statusMessages[statusKey]}
          />
        </aside>

        {/* Main content — news only */}
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {/* Stat cards */}
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title={t.statItemsTitle} value={`${items.length}`} note={t.statItemsNote} />
            <StatCard title={t.statTimelineTitle} value={rangeLabel} note={t.statTimelineNote} />
            <StatCard title={t.statFeedTitle} value={feedValue} note={t.statFeedNote} />
            <StatCard title={t.statLangTitle} value={t.langValue} note={t.statLangNote} />
          </section>

          {/* News feed */}
          <Card className={cn("rounded-[24px] border shadow-none", palette.shell)}>
            <CardHeader className="space-y-3 pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <CardTitle className={cn("text-xl", palette.text)}>
                    {rangeLabel} {t.rangeSuffix}
                  </CardTitle>
                  <CardDescription className={cn("text-xs mt-0.5", palette.subtext)}>
                    {t.briefingDesc}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Tabs value={range} onValueChange={(value) => setRange(value as RangeKey)}>
                    <TabsList className={cn("grid w-full grid-cols-3 rounded-xl", palette.soft)}>
                      <TabsTrigger value="day" className="rounded-lg text-xs">{t.tabToday}</TabsTrigger>
                      <TabsTrigger value="week" className="rounded-lg text-xs">{t.tabWeek}</TabsTrigger>
                      <TabsTrigger value="month" className="rounded-lg text-xs">{t.tabMonth}</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <Tabs value={language} onValueChange={(value) => setLanguage(value as "en" | "np")}>
                    <TabsList className={cn("grid w-full grid-cols-2 rounded-xl", palette.soft)}>
                      <TabsTrigger value="en" className="rounded-lg text-xs">{t.tabEnFirst}</TabsTrigger>
                      <TabsTrigger value="np" className="rounded-lg text-xs">{t.tabNpFirst}</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </div>
              <PaginationBar page={safePage} totalPages={totalPages} onPageChange={setPage} />
            </CardHeader>
            <CardContent className="space-y-3">
              {paginatedItems.length > 0 ? (
                paginatedItems.map((item) => (
                  <NewsCard key={item.id} item={item} />
                ))
              ) : (
                <div
                  className={cn(
                    "rounded-2xl border border-dashed p-8 text-center text-sm",
                    palette.panel,
                    palette.muted
                  )}
                >
                  {t.noStories}
                </div>
              )}
              <PaginationBar page={safePage} totalPages={totalPages} onPageChange={setPage} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
