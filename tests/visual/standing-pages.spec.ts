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
// gives it a stable accessible name so the screenshot is scoped to just that
// component.
//
// It is NOT taken with `locator.toHaveScreenshot()`, and the reason cost a CI
// failure that no baseline regeneration could fix. An element screenshot is
// sized from the element's box in page coordinates, and the CTA's vertical
// position is whatever the feed above it adds up to — a fraction of a pixel that
// differs between the machine that made the baseline and the runner that checks
// it. Measured here: the section is 437.90625px tall at y = 2475.796875, and
// shifting the page down by 0.25px alone changes the screenshot from 1216×439
// to 1216×438. CI reported exactly that — "Expected 1216px by 439px, received
// 1216px by 438px" — and a size mismatch is a hard failure that no
// `maxDiffPixelRatio` can absorb.
//
// So the clip is computed from the *rounded* box, which does not depend on the
// fractional offset, and pulled in by INSET so it never lands on the section's
// 1px border, where a sub-pixel shift would otherwise change a whole row of
// pixels. What it asserts — copy, type, spacing, the input and button — is
// unchanged; only the dependence on where on the page it happens to sit is gone.
const CTA_INSET = 2;

test("newsletter CTA matches its baseline", async ({ page }) => {
  await page.goto("/");
  const cta = page.getByRole("region", {
    name: "One email. Every morning. Nothing else.",
  });
  await cta.scrollIntoViewIfNeeded();

  const clip = await cta.evaluate((el, inset) => {
    const box = el.getBoundingClientRect();
    return {
      x: Math.round(box.left + window.scrollX) + inset,
      y: Math.round(box.top + window.scrollY) + inset,
      width: Math.round(box.width) - 2 * inset,
      height: Math.round(box.height) - 2 * inset,
    };
  }, CTA_INSET);

  await expect(page).toHaveScreenshot("newsletter-cta.png", {
    fullPage: true,
    clip,
    animations: "disabled",
  });
});
