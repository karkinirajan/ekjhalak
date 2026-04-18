"use client";

import { useMemo, useState } from "react";
import { Languages, MoonStar, RefreshCw, Search, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SystemLogo } from "@/components/system-logo";
import { cn } from "@/lib/utils";
import type { RangeKey } from "@/lib/news-pipeline";
import { useTheme } from "@/components/theme-provider";

type BucketFilter = "all" | "national" | "international";

interface TopNavbarProps {
  searchDraft: string;
  setSearchDraft: (value: string) => void;
  applySearch: () => void;
  fetchFeed: (isBackground?: boolean) => Promise<void>;
  loadState: "idle" | "refreshing" | "error";
  themeMode: "dark" | "light";
  setThemeMode: (value: "dark" | "light") => void;
  language: "en" | "np";
  setLanguage: (value: "en" | "np") => void;
  range: RangeKey;
  setRange: (value: RangeKey) => void;
  bucket: BucketFilter;
  setBucket: (value: BucketFilter) => void;
  rangeLabel: string;
  filteredCount: number;
}

export function TopNavbar({
  searchDraft,
  setSearchDraft,
  applySearch,
  fetchFeed,
  loadState,
  themeMode,
  setThemeMode,
  language,
  setLanguage,
  range,
  setRange,
  bucket,
  setBucket,
  rangeLabel,
  filteredCount,
}: TopNavbarProps) {
  const { palette, t } = useTheme();
  const isSpinning = loadState === "refreshing";
  const [isSubscribeOpen, setIsSubscribeOpen] = useState(false);
  const [subscribeEmail, setSubscribeEmail] = useState("");
  const [subscribeError, setSubscribeError] = useState("");
  const [isSubscribed, setIsSubscribed] = useState(false);

  const ui = useMemo(
    () =>
      language === "np"
        ? {
            subscribe: "सदस्यता",
            title: "डेली ब्रिफिङ सदस्यता",
            desc: "तपाईंको इमेलमा छोटो र सही ब्रिफिङ पठाइनेछ।",
            placeholder: "example@email.com",
            cta: "सदस्यता लिनुहोस्",
            close: "बन्द गर्नुहोस्",
            invalid: "कृपया मान्य इमेल ठेगाना राख्नुहोस्।",
            success: "धन्यवाद! तपाईं सदस्य हुनु भयो।",
          }
        : {
            subscribe: "Subscribe",
            title: "Subscribe to Daily Briefings",
            desc: "Get short, accurate updates delivered to your inbox.",
            placeholder: "example@email.com",
            cta: "Subscribe",
            close: "Close",
            invalid: "Please enter a valid email address.",
            success: "Thanks! You are now subscribed.",
          },
    [language],
  );

  const rangeOptions = [
    { key: "day" as const, label: t.rangeDay },
    { key: "week" as const, label: t.rangeWeek },
    { key: "month" as const, label: t.rangeMonth },
  ];

  const bucketOptions = [
    { key: "all" as const, label: t.feedAll },
    { key: "national" as const, label: t.feedNational },
    { key: "international" as const, label: t.feedInternational },
  ];

  return (
    <div className="sticky top-0 z-50">
      <div
        className={cn(
          "pointer-events-none absolute inset-0 rounded-none border-x-0 border-t-0 backdrop-blur-xl",
          palette.shell,
        )}
      />
      <div className="relative px-2.5 pt-3 pb-3 sm:px-4">
        <div className="flex flex-col gap-3">
          {/* Brand row */}
          <div className="flex min-w-0 items-center justify-between gap-2 sm:gap-3">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <SystemLogo themeMode={themeMode} className="shrink-0" />
              <div className="flex min-w-0 flex-col items-start justify-center leading-tight">
                <div className="flex min-w-0 items-baseline gap-1.5 sm:gap-2.5">
                  <p
                    className={cn(
                      "hidden font-sans text-[14px] font-extrabold uppercase tracking-[0.16em] sm:block",
                      palette.text,
                    )}
                  >
                    EKJN
                  </p>
                  <span
                    className={cn(
                      "hidden text-sm font-semibold sm:inline",
                      palette.muted,
                    )}
                  >
                    |
                  </span>
                  <p
                    className={cn(
                      "truncate font-display text-base font-semibold tracking-tight",
                      palette.text,
                    )}
                  >
                    EkJhalak
                  </p>
                </div>
                <p
                  className={cn(
                    "hidden text-[11px] font-medium md:block",
                    palette.muted,
                  )}
                >
                  {t.briefingDesc}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsSubscribeOpen(true);
                  setSubscribeError("");
                }}
                className={cn(
                  "hidden h-8 rounded-lg px-2.5 text-[11px] sm:inline-flex",
                  palette.ghost,
                )}
                aria-label={ui.subscribe}
              >
                {ui.subscribe}
              </Button>

              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => fetchFeed(false)}
                disabled={isSpinning}
                className={cn("h-8 w-8 rounded-lg", palette.ghost)}
                aria-label={t.refreshFeed}
              >
                <RefreshCw
                  className={cn("h-3.5 w-3.5", isSpinning && "animate-spin")}
                  aria-hidden="true"
                />
              </Button>

              <Button
                variant="outline"
                size="icon-sm"
                onClick={() =>
                  setThemeMode(themeMode === "dark" ? "light" : "dark")
                }
                className={cn("h-8 w-8 rounded-lg", palette.ghost)}
                aria-label={themeMode === "dark" ? t.themeLight : t.themeDark}
              >
                {themeMode === "dark" ? (
                  <Sun className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <MoonStar className="h-3.5 w-3.5" aria-hidden="true" />
                )}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setLanguage(language === "en" ? "np" : "en")}
                className={cn(
                  "h-8 rounded-lg px-2 text-[11px] sm:px-2.5",
                  palette.ghost,
                )}
                aria-label={t.langToggleLabel}
              >
                <Languages
                  className="h-3.5 w-3.5 sm:mr-1"
                  aria-hidden="true"
                />
                <span className="hidden sm:inline">{t.langButton}</span>
              </Button>
            </div>
          </div>

          {/* Filter + search row */}
          <div
            className={cn(
              "grid gap-2 rounded-xl border px-3 py-2.5",
              palette.panel,
            )}
          >
            <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
              <div className="flex items-center gap-1.5 sm:justify-self-start">
                <span
                  className={cn(
                    "text-[10px] font-semibold uppercase tracking-wider",
                    palette.muted,
                  )}
                >
                  {t.statTimelineTitle}
                </span>
                <div className="flex gap-1">
                  {rangeOptions.map((item) => (
                    <Button
                      key={item.key}
                      variant="outline"
                      size="sm"
                      onClick={() => setRange(item.key)}
                      aria-pressed={range === item.key}
                      className={cn(
                        "h-7 rounded-md px-2 text-[11px]",
                        range === item.key ? palette.accent : palette.ghost,
                      )}
                    >
                      {item.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-1.5 sm:justify-self-center">
                <span
                  className={cn(
                    "text-[10px] font-semibold uppercase tracking-wider",
                    palette.muted,
                  )}
                >
                  {t.statFeedTitle}
                </span>
                <div className="flex gap-1">
                  {bucketOptions.map((item) => (
                    <Button
                      key={item.key}
                      variant="outline"
                      size="sm"
                      onClick={() => setBucket(item.key)}
                      aria-pressed={bucket === item.key}
                      className={cn(
                        "h-7 rounded-md px-2 text-[11px]",
                        bucket === item.key ? palette.accent : palette.ghost,
                      )}
                    >
                      {item.label}
                    </Button>
                  ))}
                </div>
              </div>

              <span
                className={cn(
                  "text-xs tabular-nums sm:justify-self-end",
                  palette.muted,
                )}
              >
                {filteredCount} {t.filtered} · {rangeLabel}
              </span>
            </div>

            <form
              className="flex min-w-0 items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                applySearch();
              }}
              role="search"
            >
              <div className="relative min-w-0 flex-1">
                <Search
                  className={cn(
                    "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-75",
                    palette.muted,
                  )}
                  aria-hidden="true"
                />
                <Input
                  value={searchDraft}
                  onChange={(e) => setSearchDraft(e.target.value)}
                  placeholder={t.searchPlaceholder}
                  aria-label={t.searchPlaceholder}
                  className={cn(
                    "h-9 w-full rounded-lg pl-9 text-sm",
                    palette.input,
                  )}
                />
              </div>
              <Button
                type="submit"
                variant="outline"
                size="icon-sm"
                className={cn("h-9 w-9 shrink-0 rounded-lg", palette.ghost)}
                aria-label={t.searchPlaceholder}
              >
                <Search className="h-4 w-4" aria-hidden="true" />
              </Button>
            </form>
          </div>
        </div>
      </div>

      {isSubscribeOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={ui.title}
        >
          <button
            type="button"
            onClick={() => setIsSubscribeOpen(false)}
            className="absolute inset-0 bg-black/45"
            aria-label={ui.close}
          />
          <div
            className={cn(
              "relative w-full max-w-md rounded-2xl border p-5 shadow-2xl",
              palette.panel,
            )}
          >
            <div className="space-y-1">
              <h3 className={cn("text-sm font-semibold", palette.text)}>
                {ui.title}
              </h3>
              <p className={cn("text-xs", palette.muted)}>{ui.desc}</p>
            </div>

            {isSubscribed ? (
              <div className="mt-4 space-y-4">
                <p className={cn("text-sm", palette.subtext)}>{ui.success}</p>
                <Button
                  type="button"
                  variant="outline"
                  className={cn("h-9 rounded-lg", palette.ghost)}
                  onClick={() => setIsSubscribeOpen(false)}
                >
                  {ui.close}
                </Button>
              </div>
            ) : (
              <form
                className="mt-4 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const email = subscribeEmail.trim().toLowerCase();
                  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

                  if (!isValidEmail) {
                    setSubscribeError(ui.invalid);
                    return;
                  }

                  setSubscribeError("");
                  setSubscribeEmail(email);
                  setIsSubscribed(true);
                }}
              >
                <Input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={subscribeEmail}
                  onChange={(e) => setSubscribeEmail(e.target.value)}
                  placeholder={ui.placeholder}
                  className={cn("h-10 rounded-lg", palette.input)}
                  aria-label={ui.placeholder}
                />
                {subscribeError && (
                  <p className="text-xs text-red-400" role="alert">
                    {subscribeError}
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <Button
                    type="submit"
                    className={cn("h-9 rounded-lg", palette.accent)}
                  >
                    {ui.cta}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn("h-9 rounded-lg", palette.ghost)}
                    onClick={() => setIsSubscribeOpen(false)}
                  >
                    {ui.close}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
