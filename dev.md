# एक झलक — Developer Setup Guide

## Prerequisites

| Tool    | Version                |
| ------- | ---------------------- |
| Node.js | 20 LTS or 22 LTS       |
| pnpm    | 10.x (`npm i -g pnpm`) |

---

## 1. Clone & Install

```bash
git clone <your-repo-url>
cd ek-jhalak
pnpm install
```

---

## 2. Environment Variables

Copy the example file and fill in your values:

```bash
cp .env.example .env.local
```

### Required in production

| Variable               | Description                                                                                                                                        |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL` | Your production URL, e.g. `https://www.ekjhalak.news`. Used in OG tags, sitemap, and robots.txt. Defaults to `https://www.ekjhalak.news` if unset. |

### Nepali translation (optional — pick one)

The pipeline tries providers in priority order: **Azure Translator → Google → LibreTranslate-compatible endpoints → MyMemory**.

### Recommended for Vercel: Azure Translator

This is the cleanest hosted setup when you don't want to run your own LibreTranslate instance. The app uses Azure Translator from server-only code and also exposes a reusable route at `POST /api/translate`.

| Variable                    | Notes                                                    |
| --------------------------- | -------------------------------------------------------- |
| `AZURE_TRANSLATOR_KEY`      | Required Azure Translator key. Keep server-side only.    |
| `AZURE_TRANSLATOR_REGION`   | Required for regional or multi-service resources.        |
| `AZURE_TRANSLATOR_ENDPOINT` | Usually `https://api.cognitive.microsofttranslator.com`. |

| Variable                   | Notes                                                                                                                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GOOGLE_TRANSLATE_API_KEY` | Best quality. Get it from [Google Cloud Console](https://console.cloud.google.com/apis/library/translate.googleapis.com). Enable the **Cloud Translation API** and create an API key. |
| `LIBRETRANSLATE_API_URL`   | URL of a LibreTranslate instance, e.g. `https://libretranslate.com`. This is the best free low-latency option if you run your own instance or use a stable hosted endpoint.           |
| `LIBRETRANSLATE_API_KEY`   | Optional API key if your LibreTranslate instance requires auth.                                                                                                                       |
| `MYMEMORY_EMAIL`           | Last free fallback. Adding your email raises the daily cap from 100 → 500 requests.                                                                                                   |

### Cache revalidation (optional)

| Variable            | Notes                                                                                                                                                                  |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `REVALIDATE_SECRET` | Secret token that protects `POST /api/revalidate`. Always set this in production. If unset, the endpoint allows unauthenticated calls (acceptable for local dev only). |

---

## 3. Run Locally

```bash
pnpm dev        # starts Next.js dev server at http://localhost:3000
```

The first page load fetches all RSS sources in parallel — expect a 3–8 second delay on cold start. Subsequent requests are served from the 5-minute Next.js Data Cache.

---

## 4. Build & Start (Production mode locally)

```bash
pnpm build
pnpm start
```

---

## 5. On-Demand Cache Invalidation

The feed is cached for 5 minutes via `unstable_cache`. To force an immediate refresh without waiting:

```bash
# With secret configured
curl -X POST https://www.ekjhalak.news/api/revalidate \
     -H "Authorization: Bearer your-revalidate-secret"

# Without secret (dev/local only)
curl -X POST http://localhost:3000/api/revalidate
```

Returns `{ "revalidated": true, "tag": "news-feed", "timestamp": "..." }`.

---

## 6. Adding a News Source

Edit [`lib/source-registry.ts`](lib/source-registry.ts) and add a new entry to the `SOURCES` array:

```ts
{
  id: "my-source",             // unique slug
  name: "My Source",
  bucket: "national",          // "national" | "international"
  country: "NP",               // ISO 3166-1 alpha-2
  language: "en",              // "en" | "np" | "multi"
  categories: ["politics"],
  rssUrl: "https://example.com/rss",
  homepageUrl: "https://example.com",
  priority: 7,                 // 1–10; higher wins dedup ties
  active: true,
  credibilityScore: 7,         // editorial judgment 1–10
  note: "Short description",
  // urlPrefix: "https://example.com/news/", // optional: filter feed items by URL prefix
},
```

Then add the source's image CDN hostname to `next.config.ts` under `images.remotePatterns` if it serves article images.

---

## 7. Vercel Deployment

1. Push to GitHub and import the repo into Vercel.
2. Set the environment variables in **Project → Settings → Environment Variables**.
3. The build command is `pnpm build` and the output directory is `.next` (auto-detected).

### Recommended Vercel settings

| Setting          | Value          |
| ---------------- | -------------- |
| Node.js version  | 20.x           |
| Build command    | `pnpm build`   |
| Install command  | `pnpm install` |
| Output directory | `.next`        |

### Automatic revalidation via Vercel Cron (optional)

To keep the feed fresh even when traffic is low, add a cron job in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/revalidate?secret=YOUR_REVALIDATE_SECRET",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

> The Vercel free plan includes up to 2 cron jobs.

---

## 8. Project Structure

```
app/
  page.tsx              — Main client page (feed, filters, pagination)
  layout.tsx            — Root layout (fonts, metadata, ThemeProvider)
  loading.tsx           — Loading fallback (Suspense boundary)
  not-found.tsx         — 404 page
  robots.ts             — Dynamic robots.txt
  sitemap.ts            — Dynamic sitemap.xml
  api/
    news/route.ts       — GET /api/news?range=&bucket=&limit=
    sources/route.ts    — GET /api/sources (source list + live status)
    translate/route.ts  — POST /api/translate (Azure Translator proxy)
    revalidate/route.ts — POST /api/revalidate (on-demand cache bust)

components/
  app-sidebar.tsx       — Desktop sidebar (filters, source list)
  top-navbar.tsx        — Sticky top bar (search, theme, language)
  brand-image.tsx       — Shared responsive logo component
  news-card.tsx         — Article card with brief sheet
  pagination-bar.tsx    — Page navigation
  theme-provider.tsx    — ThemeContext (dark/light, en/np)

lib/
  source-registry.ts    — Canonical list of all news sources
  aggregator.ts         — Parallel RSS fetch + dedup + translate (5-min cache)
  rss-adapter.ts        — RSS 2.0 / Atom 1.0 parser (fast-xml-parser)
  feed-normalizer.ts    — RawStory → NewsItem conversion + URL fingerprinting
  deduplicator.ts       — Exact-URL + Jaccard-title deduplication
  azure-translator.ts   — Azure Translator REST client
  translator.ts         — Google → LibreTranslate → MyMemory pipeline
  news-pipeline.ts      — Shared TypeScript types
  themes.ts             — Palette definitions (dark / light)
  i18n.ts               — English / Nepali strings
```

---

## 9. Translation Pipeline Details

Translations are computed **inside the cache boundary** (in `aggregator.ts`) so API calls happen at most once per 5-minute window, not on every request.

| Provider         | Quality | Cost                   | Config                                     |
| ---------------- | ------- | ---------------------- | ------------------------------------------ |
| Google Translate | ★★★★★   | Paid (~$20/1M chars)   | `GOOGLE_TRANSLATE_API_KEY`                 |
| LibreTranslate   | ★★★★    | Free/self-host         | `LIBRETRANSLATE_API_URL` + optional key    |
| MyMemory         | ★★★     | Free (100–500 req/day) | Optional `MYMEMORY_EMAIL` for higher quota |

LibreTranslate is now the default free-first path. The app tries configured `LIBRETRANSLATE_API_URL` first, then built-in public LibreTranslate-compatible endpoints with short timeouts and temporary cooldowns for dead endpoints.

MyMemory has a 500-character limit per request; the pipeline auto-splits longer summaries into sentence chunks and reassembles them.

When quota is hit, MyMemory enters a 30-minute cooldown. The UI gracefully falls back to showing the English summary for any article without a Nepali translation.

---

## 10. Dark Mode Logo

The logo (`/public/logo.png`) uses CSS blend modes to work on both themes:

- **Light mode**: `mix-blend-multiply` dissolves the white background into the warm shell.
- **Dark mode**: `mix-blend-screen` inverts the image so the letterforms remain visible.

If you want a custom transparent PNG for dark mode (higher fidelity), export it as `/public/ekjhalak-dark-transparent.png` (PNG-24 with transparency) and update `components/brand-image.tsx` to use it conditionally by re-adding the `isDark` branch.

---

## 11. Common Issues

### Feed is empty on first load

Cold starts take 3–10 seconds while all sources are fetched. If it stays empty:

- Open browser DevTools → Network → check `/api/news` for errors.
- Check the terminal for `[aggregator]` or `[rss-adapter]` errors.
- Some sources (especially Nepali dailies) may be rate-limited or temporarily down — this is normal and the rest of the feed still loads.

### Translations not showing (Nepali mode)

- MyMemory free tier: 100 requests/day per IP. On cold start with 100+ English articles, the quota may be exhausted quickly.
- Set `MYMEMORY_EMAIL` to get 500/day, or use Google Translate for production.
- While rate-limited, articles show the English summary as a fallback.

### Hydration warning in browser console

ThemeProvider reads `localStorage` in `useEffect`, causing a brief dark → light flash on first visit if the user's saved preference is light. This is cosmetic. Both `<html>` and `<body>` have `suppressHydrationWarning` to prevent React hydration errors from theme-class mismatches.

### Image not found (404 in Next.js Image Optimization)

If an article image returns 404 from an external CDN, the `NewsCard` component gracefully hides the image via `onError`. If the CDN hostname isn't in `next.config.ts → images.remotePatterns`, Next.js will refuse to optimize it — add the hostname to fix.
