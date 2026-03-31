"use client"

import { useEffect, useMemo, useState } from "react"
import { Languages, Menu, MoonStar, Newspaper, Search, Sun } from "lucide-react"
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

import { emptyData, type RangeKey } from "@/lib/news-pipeline"

const PAGE_SIZE = 20

export default function ClutterFreeNewsPage() {
  const { palette, language, setLanguage, t, themeMode, setThemeMode } = useTheme()
  const [range, setRange] = useState<RangeKey>("day")
  const [bucket, setBucket] = useState<"all" | "national" | "international">("all")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    setPage(1)
  }, [range, bucket, language, search])

  useEffect(() => {
    const titleSuffix = language === "np" ? "स्वदेश र विदेश" : "National & International"
    document.title = `एक झलक — ${titleSuffix}`
  }, [language])

  const rangeLabel = range === "day" ? t.rangeDay : range === "week" ? t.rangeWeek : t.rangeMonth

  const items = useMemo(() => {
    const current = emptyData[range]
    const merged =
      bucket === "all"
        ? [...current.national, ...current.international]
        : current[bucket]
    const sorted = [...merged].sort((a, b) => a.title.localeCompare(b.title))

    return sorted.filter((item) =>
      [item.title, item.source, item.summaryEn, item.summaryNp]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase())
    )
  }, [bucket, language, range, search])

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paginatedItems = items.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const feedValue =
    bucket === "all" ? t.feedValueAll
    : bucket === "national" ? t.feedValueNational
    : t.feedValueInternational

  return (
    <div className={cn("min-h-screen bg-gradient-to-br flex", palette.app, palette.page)}>
      {/* Sidebar - Full height, fixed position */}
      <aside className="hidden w-[260px] shrink-0 lg:flex flex-col fixed left-0 top-0 h-screen z-40">
        <AppSidebar
          range={range}
          setRange={setRange}
          bucket={bucket}
          setBucket={setBucket}
        />
      </aside>

      {/* Main content area */}
      <div className="flex min-w-0 flex-1 flex-col lg:ml-[260px]">
        {/* Main content */}
        <div className="flex min-w-0 flex-1 flex-col gap-3 p-2 pt-0 lg:p-3 lg:pt-0 overflow-y-auto">
          {/* News feed */}
          <Card className={cn("border rounded-md", palette.shell)}>
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex flex-col gap-3">
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
                    aria-label="Menu"
                  >
                    <Menu className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                  <div>
                    <CardTitle className={cn("text-lg font-semibold", palette.text)}>
                      {rangeLabel} {t.rangeSuffix}
                    </CardTitle>
                    <CardDescription className={cn("text-sm mt-0.5", palette.muted)}>
                      {t.briefingDesc}
                    </CardDescription>
                  </div>
                  <div className={cn("flex items-center gap-6 border-l pl-6 md:border-l-0 md:pl-0", palette.muted)}>
                    <div className="flex flex-col">
                      <div className="text-sm uppercase tracking-wide opacity-70 font-medium">{t.statItemsTitle}</div>
                      <div className={cn("text-sm font-medium", palette.text)}>{items.length}</div>
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
                        {bucket === "national" ? t.sectionNepal : t.sectionInternational}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 px-4 pb-4">
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
                >
                  {t.noStories}
                </div>
              )}
              <PaginationBar page={safePage} totalPages={totalPages} onPageChange={setPage} />
            </CardContent>
          </Card>

          {/* Footer - Same width as navbar */}
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

      {/* Mobile Menu Sheet - Simplified */}
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

            {/* Language */}
            <div>
              <div className={cn("mb-2 text-xs uppercase tracking-wide", palette.muted)}>{t.statLangTitle}</div>
              <div className="grid grid-cols-2 gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setLanguage("en"); setMobileMenuOpen(false); }}
                  className={cn("h-9 text-xs rounded-md", language === "en" ? palette.accent : palette.ghost)}
                >
                  {t.tabEnFirst}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setLanguage("np"); setMobileMenuOpen(false); }}
                  className={cn("h-9 text-xs rounded-md", language === "np" ? palette.accent : palette.ghost)}
                >
                  {t.tabNpFirst}
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
