import { test, expect } from "@playwright/test";

// These five routes and the 404 page are the only ones in the app that render
// the same content on every request — everything else goes through the live
// feed (`NewsFeed`) or a specific, ever-changing story (`/story/[id]`), which
// is why neither is screenshotted here. See playwright.config.ts for why.
const STATIC_ROUTES = [
  "/about",
  "/privacy",
  "/terms",
  "/editorial-standards",
  "/contact",
] as const;

for (const route of STATIC_ROUTES) {
  test(`${route} matches its baseline`, async ({ page }) => {
    await page.goto(route);
    await expect(page).toHaveScreenshot(`${route.slice(1)}.png`, {
      fullPage: true,
      animations: "disabled",
    });
  });
}

test("404 page matches its baseline", async ({ page }) => {
  await page.goto("/this-page-does-not-exist");
  await expect(page).toHaveScreenshot("404.png", {
    fullPage: true,
    animations: "disabled",
  });
});

// `NewsletterCta` is the one reusable component with real interactive states
// that never appears on a standing page — it sits at the foot of the
// homepage grid. The component itself (copy, layout, button, input) is
// static; only the stories above it on `/` are not. `<section aria-label>`
// gives it a stable accessible name to scope the screenshot to just that
// component, so a feed re-rank between runs can never touch this assertion.
test("newsletter CTA matches its baseline", async ({ page }) => {
  await page.goto("/");
  const cta = page.getByRole("region", {
    name: "One email. Every morning. Nothing else.",
  });
  await cta.scrollIntoViewIfNeeded();
  await expect(cta).toHaveScreenshot("newsletter-cta.png", {
    animations: "disabled",
  });
});
