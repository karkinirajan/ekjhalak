import type { Metadata } from "next";
import {
  Inter,
  JetBrains_Mono,
  Noto_Sans_Devanagari,
  Playfair_Display,
} from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { SpeedInsights } from "@vercel/speed-insights/next";

// Body and interface — Inter's tall x-height keeps dense summary copy readable
// at small sizes next to Devanagari.
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// English headlines. Playfair's high stroke contrast is what makes a page read
// as a publication rather than a product dashboard.
const playfair = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
  style: ["normal", "italic"],
  display: "swap",
});

// Nepali headlines and body. Carries the same weight range as Playfair so
// bilingual headlines sit at matching visual weight.
const notoDevanagari = Noto_Sans_Devanagari({
  variable: "--font-devanagari",
  subsets: ["devanagari"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// Metadata voice — kickers, timestamps, source names, counters.
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono-custom",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.ekjhalak.news";
const SITE_NAME = "EkJhalak News";
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
      className={`${inter.variable} ${playfair.variable} ${notoDevanagari.variable} ${jetbrainsMono.variable}`}
    >
      <head>
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
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-100 focus:rounded-md focus:bg-coral focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lift"
        >
          Skip to main content
        </a>
        <ThemeProvider>
          <main id="main-content">{children}</main>
        </ThemeProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
