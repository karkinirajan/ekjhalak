import type { Metadata } from "next";
import { Inter, Mukta, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { SiteProvider } from "@/components/site-provider";
import { SITE_NAME, SITE_URL } from "@/lib/site-url";

// Headlines are set in Source Serif 4.
//
// They were set in Outfit, a geometric sans, under a comment describing it as a
// "vibrant, modern tech-forward voice" — which is exactly what it reads as, and
// exactly what a news site must not. Every newsroom this site aggregates from
// sets its headlines in a serif: the Kathmandu Post in Merriweather, the
// Guardian in Guardian Headline, the NYT in Cheltenham, the BBC in Reith Serif,
// the SCMP in Mixta Pro and Source Serif. A geometric sans headline is the
// single strongest signal that a page is a product rather than a publication,
// and no palette put behind it changes that.
//
// Source Serif 4 rather than a text serif like Merriweather because this is a
// briefing: headlines here run 15-26px, not 40px, and Source Serif was drawn
// for screen at exactly that range with a variable optical size. It also has a
// genuine 600, so a headline can be set in medium-bold without the smeared
// look a synthesized weight gives a serif.
//
// 400 is not loaded. Headlines resolve to 600 through the h1-h4 rule in
// globals.css and to 700 at the two display sizes (the 404 numeral and the
// reader's drop cap); walking every route in both languages found no element
// rendering this family at 400, so the file was one more preloaded weight
// competing with the LCP image for a throttled connection's first second.
const sourceSerif = Source_Serif_4({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
});

// English body copy, UI chrome and all metadata use Inter.
//
// Metadata included: the kickers, timestamps and source names were set in
// JetBrains Mono, and monospace on a news page reads as a terminal, not a
// masthead. The NYT sets the same material in its own sans at 11px/500, the
// Guardian in Guardian Text Sans. One sans doing body, UI and metadata is also
// one fewer family on the wire.
const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
// 300 dropped; nothing sets a light weight on Devanagari. 500 dropped too, and
// the reason has moved: it used to be reached only by `.eyebrow`, which is now
// set in Inter. What reaches it today is the breaking ticker, whose headlines
// are `font-medium` — about seventeen of them on a first paint. CSS weight
// matching resolves a missing 500 down to 400 rather than synthesizing
// anything, so those render one step lighter and nothing else happens. That is
// a barely visible change to a scrolling strip in exchange for 65 KiB off a
// preload block that competes with the lead image for a throttled connection's
// first second — Devanagari weights are the heaviest files on the page at
// roughly 65 KiB each.
//
// 700 is loaded and must stay. It looks unused when the site is walked in
// English, because the Nepali UI headings that reach for it only render once a
// reader switches language; measured in Nepali it is on five elements of the
// homepage alone. Dropping it would leave the browser synthesizing bold
// Devanagari, which is the conjunct-breaking failure Mukta was chosen to avoid.
//
// 600 and 700 both stay: headlines are font-semibold, and the trending rail and
// newsletter headings are font-bold in Nepali. Synthesized bold breaks Devanagari
// conjuncts apart, which is exactly the failure Mukta was chosen to avoid.
// Preloaded, and the measurement backs it. Dropping the preload to win back
// bandwidth for the LCP image made the page slower, not faster: first
// contentful paint went 1.2s to 2.5s, layout shift appeared where there had
// been none, and the Lighthouse score fell from 82 to 78. Devanagari has no
// system fallback worth swapping from, so deferring it defers the headline.
const mukta = Mukta({
  variable: "--font-devanagari",
  subsets: ["devanagari", "latin"],
  weight: ["400", "600", "700"],
  display: "swap",
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
      className={`${sourceSerif.variable} ${inter.variable} ${mukta.variable}`}
    >
      <head>
        {/* The site is light only, so the browser paints form controls and
            scrollbars light too rather than inverting them on a reader whose
            OS is set to dark. */}
        <meta name="color-scheme" content="light" />
        {/* Browser chrome matches the page instead of defaulting to white,
            which on mobile is the difference between the app looking like it
            ends at the viewport and looking like it was pasted into the
            browser. One value, because there is one theme: --canvas. */}
        <meta name="theme-color" content="#ffffff" />
        {/* Runs before first paint so a Nepali reader's saved language is on
            <html lang> before the first headline renders, rather than being
            corrected by React a frame later. There is no theme half to this
            script any more — the palette is unconditional. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(localStorage.getItem('cfn-lang')==='np'){document.documentElement.lang='ne'}}catch(e){}})()`,
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
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-100 focus:rounded-md focus:bg-accent-solid focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lift"
        >
          Skip to main content
        </a>
        <SiteProvider>
          <main id="main-content">{children}</main>
        </SiteProvider>
      </body>
    </html>
  );
}
