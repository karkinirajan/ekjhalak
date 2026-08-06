import type { Metadata } from "next";
import {
  JetBrains_Mono,
  Merriweather,
  Mukta,
  Space_Grotesk,
} from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { SITE_NAME, SITE_URL } from "@/lib/site-url";

// English UI and headlines use Space Grotesk for a crisp modern voice.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// English body copy uses Merriweather for long-form readability.
//
// 400 for prose and 700 for emphasis inside it. 300 and 900 were declared and
// never reached: nothing in the app sets a light weight, and every `font-black`
// in the codebase sits on a `font-display` element, so Merriweather 900 was two
// files downloaded to render nothing.
//
// Not preloaded. It sets body copy, which is below the headline in every layout
// here, and Georgia — the first fallback — is close enough in metrics that the
// swap does not move text around. Preloading it made four font files compete
// with the lead image for a throttled connection's first bytes.
const merriweather = Merriweather({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  preload: false,
});

// Nepali content is set in Mukta — the face Kantipur uses.
//
// ekantipur.com declares `body { font-family: "Mukta" }` and reaches for it
// again on headlines, navigation and the ticker, so it is the typeface a Nepali
// reader already associates with reading the news online. Mukta was drawn for
// Devanagari first rather than extended into it, which is why its matras and
// conjuncts hold together at body sizes where a Latin-first family with a
// Devanagari range starts to look grafted on.
//
// Preloaded, and one of only two that are: a Nepali headline is above the fold
// on every visit, and Devanagari has no safe system fallback to swap from — the
// chain below it ends in a generic sans that renders the matras wrong.
//
// 300 dropped; nothing sets a light weight on Devanagari. 500 dropped too, for a
// narrower reason: it is reached only by `.eyebrow`, which is nav pills and
// timestamps, and CSS weight matching resolves a missing 500 down to 400 rather
// than synthesizing anything. That is a barely visible change to secondary text
// in exchange for 65 KiB off a preload block that competes with the lead image
// for a throttled connection's first second — Devanagari weights are the four
// heaviest files on the page at roughly 65 KiB each.
//
// 600 and 700 both stay: headlines are font-semibold, and the trending rail and
// newsletter headings are font-bold in Nepali. Synthesized bold breaks Devanagari
// conjuncts apart, which is exactly the failure Mukta was chosen to avoid.
const mukta = Mukta({
  variable: "--font-devanagari",
  subsets: ["devanagari", "latin"],
  weight: ["400", "600", "700"],
  display: "swap",
});

// Metadata voice — kickers, timestamps, source names, counters.
//
// Not preloaded. Every one of those is small, secondary text; a monospace swap
// is the least noticeable one on the page, and none of it is what a reader is
// waiting for.
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono-custom",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  preload: false,
});

const SITE_DESCRIPTION =
  "Calm bilingual news briefings for Nepal and the world. Clean, original-language summaries — no clutter, no noise.";
const OG_IMAGE_URL = `${SITE_URL}/og-image.png`;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "EkJhalak News — Nepal & World briefings",
    template: "%s · EkJhalak News",
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "Nepal news",
    "Nepali news",
    "नेपाल समाचार",
    "bilingual news",
    "news aggregator",
    "international news",
    "national news Nepal",
    "ekjhalak",
  ],
  authors: [{ name: "kneeraazon", url: "https://kneeraazon.com" }],
  creator: "kneeraazon",
  openGraph: {
    type: "website",
    locale: "en_US",
    alternateLocale: "ne_NP",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: "EkJhalak News — Nepal & World briefings",
    description: SITE_DESCRIPTION,
    images: [
      {
        url: OG_IMAGE_URL,
        width: 1200,
        height: 630,
        type: "image/png",
        alt: "EkJhalak News",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "EkJhalak News — Nepal & World briefings",
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE_URL],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    other: [
      { rel: "manifest", url: "/site.webmanifest" },
      {
        rel: "android-chrome",
        url: "/android-chrome-192x192.png",
        sizes: "192x192",
      },
      {
        rel: "android-chrome",
        url: "/android-chrome-512x512.png",
        sizes: "512x512",
      },
    ],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "EkJhalak News",
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  inLanguage: ["en", "ne"],
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${SITE_URL}/?search={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-theme="light"
      className={`${spaceGrotesk.variable} ${merriweather.variable} ${mukta.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        {/* Lets the browser paint form controls and scrollbars to match
            whichever theme the script below settles on. */}
        <meta name="color-scheme" content="light dark" />
        {/* Browser chrome matches the page instead of defaulting to white, which
            on mobile is the difference between the app looking like it ends at
            the viewport and looking like it was pasted into the browser. Both
            values are --canvas, per theme. */}
        <meta
          name="theme-color"
          content="#fdfcf9"
          media="(prefers-color-scheme: light)"
        />
        <meta
          name="theme-color"
          content="#0a0a0a"
          media="(prefers-color-scheme: dark)"
        />
        {/* Runs before first paint so the correct theme is painted once.
            Falls back to the OS preference when the reader has no saved choice. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('cfn-theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.setAttribute('data-theme',t);var l=localStorage.getItem('cfn-lang');if(l==='np'){document.documentElement.lang='ne'}}catch(e){}})()`,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body suppressHydrationWarning>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-100 focus:rounded-md focus:bg-red-solid focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lift"
        >
          Skip to main content
        </a>
        <ThemeProvider>
          <main id="main-content">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
