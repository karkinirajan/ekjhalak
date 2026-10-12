import { defineConfig, devices } from "@playwright/test";

// Visual regression only. Unit tests stay on node --test (see package.json
// "test"); this is the one thing that tool structurally cannot catch — a
// contrast ratio or a layout broken by an opacity utility at render time, on
// the three reusable `components/ui/` primitives and the standing pages that
// render them.
//
// Scope is deliberately NOT the homepage. `/` renders a live, continuously
// re-ranked news feed — headlines, images and story counts differ between
// any two loads, including the two Playwright would take to generate and
// then verify a baseline. A pixel diff against that is not a signal, it is
// permanent noise. The standing pages (`/about`, `/privacy`, `/terms`,
// `/editorial-standards`, `/contact`) and the 404 page render the same
// `StandingPage` / `SiteFooter` / `Masthead` components with content that
// does not change between runs, which is what actually exercises the design
// system this check is meant to protect.
export default defineConfig({
  testDir: "./tests/visual",
  snapshotPathTemplate:
    "{testDir}/__snapshots__/{testFilePath}/{projectName}/{arg}{ext}",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  expect: {
    toHaveScreenshot: {
      // A touch of tolerance for anti-aliasing / subpixel font hinting
      // differences between machines, not for real visual drift.
      maxDiffPixelRatio: 0.01,
    },
  },
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
  },
  // Reuses the same `next start` the CI accessibility/SEO step already
  // boots, rather than adding a second server lifecycle to manage.
  webServer: {
    command: "pnpm run build && pnpm run start",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3000",
      REVALIDATE_SECRET: "stub",
      CRON_SECRET: "stub",
    },
  },
  projects: [
    {
      name: "chromium-light",
      use: { ...devices["Desktop Chrome"], colorScheme: "light" },
    },
    {
      name: "chromium-dark",
      use: { ...devices["Desktop Chrome"], colorScheme: "dark" },
    },
  ],
});
