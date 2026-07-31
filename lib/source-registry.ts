// lib/source-registry.ts
// Canonical source registry with RSS/Atom feed URLs.
// Sources with rssUrl === null are registered but inactive (no public feed).

export type SourceBucket = "national" | "international";
export type SourceLanguage = "en" | "np" | "multi";

export interface Source {
  /** Stable slug used as a DB-style key */
  id: string;
  name: string;
  bucket: SourceBucket;
  /** ISO 3166-1 alpha-2 country of origin */
  country: string;
  language: SourceLanguage;
  categories: string[];
  /** RSS or Atom feed URL. null = no public feed available. */
  rssUrl: string | null;
  homepageUrl: string;
  /**
   * Aggregation priority: 1–10.
   * Higher priority sources win dedup ties.
   * Also used to sort sources in the sidebar.
   */
  priority: number;
  /** false = skip this source during aggregation */
  active: boolean;
  note: string;
  /**
   * If set, only include feed items whose URL starts with this prefix.
   * Used to filter out sponsored/ad content injected into RSS feeds (e.g. CNN).
   */
  urlPrefix?: string;
  /**
   * Source credibility score 1–10 (editorial judgment).
   * Used for UI display and dedup tie-breaking where applicable.
   */
  credibilityScore?: number;
}

export interface SourceFetchStatus {
  sourceId: string;
  ok: boolean;
  itemCount: number;
  fetchedAt: number;
  error?: string;
}

export const SOURCES: Source[] = [
  // ── NATIONAL (Nepal) ───────────────────────────────────────────────────────

  {
    id: "kathmandu-post",
    name: "Kathmandu Post",
    bucket: "national",
    country: "NP",
    language: "en",
    categories: ["politics", "business", "society", "national"],
    rssUrl: "https://kathmandupost.com/rss",
    homepageUrl: "https://kathmandupost.com",
    priority: 10,
    active: true,
    credibilityScore: 9,
    note: "National + policy + business",
  },
  {
    id: "onlinekhabar-english",
    name: "Onlinekhabar English",
    bucket: "national",
    country: "NP",
    language: "en",
    categories: ["national", "politics", "society"],
    rssUrl: "https://english.onlinekhabar.com/feed",
    homepageUrl: "https://english.onlinekhabar.com",
    priority: 9,
    active: true,
    credibilityScore: 8,
    note: "Fast national updates",
  },
  {
    id: "rising-nepal",
    name: "The Rising Nepal",
    bucket: "national",
    country: "NP",
    language: "en",
    categories: ["national", "politics", "development"],
    rssUrl: "https://risingnepaldaily.com/rss",
    homepageUrl: "https://risingnepaldaily.com",
    priority: 8,
    active: true,
    credibilityScore: 8,
    note: "English state daily",
  },
  {
    id: "my-republica",
    name: "My Republica",
    bucket: "national",
    country: "NP",
    language: "en",
    categories: ["national", "politics", "business", "society"],
    rssUrl: null,
    homepageUrl: "https://myrepublica.nagariknetwork.com",
    priority: 9,
    active: false,
    credibilityScore: 8,
    note: "Leading Nepal English daily. Feed retired: /feed/ returned 403 in production and 404 on direct probe (2026-07-31); /rss and /news/feed/ are also 404. Re-enable if the outlet publishes a new endpoint.",
  },
  {
    id: "himalayan-times",
    name: "The Himalayan Times",
    bucket: "national",
    country: "NP",
    language: "en",
    categories: ["national", "politics", "business"],
    rssUrl: null,
    homepageUrl: "https://thehimalayantimes.com",
    priority: 8,
    active: false,
    credibilityScore: 7,
    note: "Nepali English broadsheet. Feed retired: /feed/ is 404 (2026-07-31), and /rss returns an HTML landing page rather than XML. Re-enable if a real feed reappears.",
  },
  {
    id: "setopati-english",
    name: "Setopati English",
    bucket: "national",
    country: "NP",
    language: "en",
    categories: ["national", "politics", "society"],
    rssUrl: null,
    homepageUrl: "https://en.setopati.com",
    priority: 7,
    active: false,
    credibilityScore: 7,
    note: "Top digital-native news in English. Feed retired: /feed/ returns 500 and /rss is 404 (2026-07-31). The outlet is still represented by the `setopati` Nepali feed below, which is healthy.",
  },
  {
    id: "setopati",
    name: "Setopati",
    bucket: "national",
    country: "NP",
    language: "np",
    categories: ["national", "politics", "breaking"],
    rssUrl: "https://www.setopati.com/feed",
    homepageUrl: "https://www.setopati.com",
    priority: 9,
    active: true,
    credibilityScore: 9,
    note: "Nepal's top Nepali digital newspaper",
  },
  {
    id: "ratopati",
    name: "Ratopati",
    bucket: "national",
    country: "NP",
    language: "np",
    categories: ["national", "breaking", "society"],
    rssUrl: "https://ratopati.com/feed",
    homepageUrl: "https://ratopati.com",
    priority: 8,
    active: true,
    credibilityScore: 7,
    note: "Fast Nepali breaking news",
  },
  {
    id: "nagarik-news",
    name: "Nagarik News",
    bucket: "national",
    country: "NP",
    language: "np",
    categories: ["national", "politics", "society"],
    rssUrl: "https://nagariknews.nagariknetwork.com/feed/",
    homepageUrl: "https://nagariknews.nagariknetwork.com",
    priority: 7,
    active: true,
    credibilityScore: 8,
    note: "Established Nepali-language daily",
  },
  {
    id: "ekantipur",
    name: "eKantipur",
    bucket: "national",
    country: "NP",
    language: "en",
    categories: ["national", "politics", "business"],
    rssUrl: null,
    homepageUrl: "https://ekantipur.com/en",
    priority: 7,
    active: false, // RSS feed format not parseable — to be re-enabled when confirmed
    credibilityScore: 8,
    note: "Major Nepali newsroom (English section)",
  },
  {
    id: "gorkhapatra",
    name: "Gorkhapatra",
    bucket: "national",
    country: "NP",
    language: "en",
    categories: ["national", "government", "development"],
    rssUrl: null,
    homepageUrl: "https://www.gorkhapatraonline.com",
    priority: 6,
    active: false, // Feed blocked — to be re-enabled when confirmed
    credibilityScore: 7,
    note: "Historic Nepali paper",
  },
  {
    id: "rss-nepal",
    name: "RSS Nepal",
    bucket: "national",
    country: "NP",
    language: "en",
    categories: ["national", "wire"],
    rssUrl: null,
    homepageUrl: "https://rssnepal.org.np",
    priority: 5,
    active: false, // Wire service — no public RSS endpoint
    credibilityScore: 8,
    note: "National wire source",
  },
  {
    id: "onlinekhabar-nepali",
    name: "Onlinekhabar (Nepali)",
    bucket: "national",
    country: "NP",
    language: "np",
    categories: ["national", "politics", "society", "breaking"],
    rssUrl: "https://www.onlinekhabar.com/feed",
    homepageUrl: "https://www.onlinekhabar.com",
    priority: 9,
    active: true,
    credibilityScore: 8,
    note: "Nepal's top Nepali-language digital news",
  },
  {
    id: "dcnepal",
    name: "DC Nepal",
    bucket: "national",
    country: "NP",
    language: "np",
    categories: ["national", "breaking", "politics", "society"],
    rssUrl: "https://www.dcnepal.com/feed/",
    homepageUrl: "https://www.dcnepal.com",
    priority: 7,
    active: true,
    credibilityScore: 7,
    note: "Nepali breaking news with rich media",
  },
  {
    id: "bizmandu",
    name: "Bizmandu",
    bucket: "national",
    country: "NP",
    language: "np",
    categories: ["business", "national", "politics"],
    rssUrl: "https://bizmandu.com/feed",
    homepageUrl: "https://bizmandu.com",
    priority: 7,
    active: true,
    credibilityScore: 7,
    note: "Nepal's #1 business news portal (Nepali)",
  },
  {
    id: "nepalkhabar",
    name: "Nepal Khabar",
    bucket: "national",
    country: "NP",
    language: "np",
    categories: ["national", "politics", "society"],
    rssUrl: "https://nepalkhabar.com/feed",
    homepageUrl: "https://nepalkhabar.com",
    priority: 7,
    active: true,
    credibilityScore: 7,
    note: "Active Nepali news portal",
  },
  {
    id: "thahakhabar",
    name: "Thaha Khabar",
    bucket: "national",
    country: "NP",
    language: "np",
    categories: ["national", "politics", "society"],
    rssUrl: "https://thahakhabar.com/feed",
    homepageUrl: "https://www.thahakhabar.com",
    priority: 7,
    active: true,
    credibilityScore: 7,
    note: "Established Nepali news portal",
  },
  {
    id: "himalkhabar",
    name: "Himal Khabar",
    bucket: "national",
    country: "NP",
    language: "np",
    categories: ["national", "politics", "opinion"],
    rssUrl: "https://www.himalkhabar.com/feed",
    homepageUrl: "https://www.himalkhabar.com",
    priority: 6,
    active: true,
    credibilityScore: 7,
    note: "Nepali opinion and analysis portal",
  },
  {
    id: "routine-nepal-banda",
    name: "Routine of Nepal Banda",
    bucket: "national",
    country: "NP",
    language: "np",
    categories: ["society", "street"],
    rssUrl: null,
    homepageUrl: "https://www.instagram.com/routineofnepalbanda/",
    priority: 4,
    active: false, // Instagram — no standard RSS; website "coming soon"
    note: "Street-level national pulse",
  },
  {
    id: "24-ghanta-nepal",
    name: "24 Ghanta Nepal",
    bucket: "national",
    country: "NP",
    language: "np",
    categories: ["national", "breaking"],
    rssUrl: null,
    homepageUrl: "https://www.instagram.com/24ghantanepal/",
    priority: 4,
    active: false, // Instagram — no standard RSS; website behind Cloudflare
    note: "24-hour Nepal news coverage",
  },
  {
    id: "nepal-in-last-24",
    name: "Nepal In Last 24 Hours",
    bucket: "national",
    country: "NP",
    language: "np",
    categories: ["national", "breaking"],
    rssUrl: null,
    homepageUrl: "https://www.instagram.com/nepalinlast24hours/",
    priority: 4,
    active: false, // Instagram — no standard RSS
    note: "Live rapid-fire Nepal updates",
  },

  // ── INTERNATIONAL ──────────────────────────────────────────────────────────

  {
    id: "reuters",
    name: "Reuters",
    bucket: "international",
    country: "GB",
    language: "en",
    categories: ["world", "business", "politics"],
    rssUrl: "https://feeds.reuters.com/reuters/topNews",
    homepageUrl: "https://www.reuters.com/world/",
    priority: 10,
    // Reuters blocks server-side fetches from shared-IP environments.
    // Re-enable if using a proxy or dedicated egress IP.
    active: false,
    credibilityScore: 10,
    note: "Fast global wire",
  },
  {
    id: "aljazeera",
    name: "Al Jazeera",
    bucket: "international",
    country: "QA",
    language: "en",
    categories: ["world", "politics", "conflict"],
    rssUrl: "https://www.aljazeera.com/xml/rss/all.xml",
    homepageUrl: "https://www.aljazeera.com/",
    priority: 9,
    active: true,
    credibilityScore: 8,
    note: "Strong international lens",
  },
  {
    id: "bbc",
    name: "BBC",
    bucket: "international",
    country: "GB",
    language: "en",
    categories: ["world", "politics", "society"],
    rssUrl: "https://feeds.bbci.co.uk/news/rss.xml",
    homepageUrl: "https://www.bbc.com/news",
    priority: 10,
    active: true,
    credibilityScore: 9,
    note: "Trusted global coverage",
  },
  {
    id: "dw",
    name: "DW",
    bucket: "international",
    country: "DE",
    language: "en",
    categories: ["world", "europe", "politics"],
    rssUrl: "https://rss.dw.com/rdf/rss-en-all",
    homepageUrl: "https://www.dw.com/en",
    priority: 8,
    active: true,
    credibilityScore: 8,
    note: "Europe + world",
  },
  {
    id: "france-24",
    name: "France 24",
    bucket: "international",
    country: "FR",
    language: "en",
    categories: ["world", "politics", "europe"],
    rssUrl: "https://www.france24.com/en/rss",
    homepageUrl: "https://www.france24.com",
    priority: 8,
    active: true,
    credibilityScore: 8,
    note: "French global news",
  },
  {
    id: "the-guardian",
    name: "The Guardian",
    bucket: "international",
    country: "GB",
    language: "en",
    categories: ["world", "politics", "society"],
    rssUrl: "https://www.theguardian.com/world/rss",
    homepageUrl: "https://www.theguardian.com",
    priority: 9,
    active: true,
    credibilityScore: 9,
    note: "UK independent voice",
  },
  {
    id: "the-hindu",
    name: "The Hindu",
    bucket: "international",
    country: "IN",
    language: "en",
    categories: ["india", "politics", "society"],
    rssUrl: "https://www.thehindu.com/feeder/default.rss",
    homepageUrl: "https://www.thehindu.com",
    priority: 9,
    active: true,
    credibilityScore: 9,
    note: "India's national daily — closely relevant to Nepal",
  },
  {
    id: "times-of-india",
    name: "Times of India",
    bucket: "international",
    country: "IN",
    language: "en",
    categories: ["india", "politics", "business"],
    rssUrl: "https://timesofindia.indiatimes.com/rssfeeds/296589292.cms",
    homepageUrl: "https://timesofindia.indiatimes.com",
    priority: 8,
    active: true,
    credibilityScore: 7,
    // Left active deliberately. This feed reported "fetch failed" during the
    // 2026-07-31 audit, but the entire indiatimes.com domain — homepage
    // included — timed out from that network while every other source resolved
    // normally. That is a egress block on the auditing host, not evidence the
    // feed is gone, and deactivating a working source on that basis would be
    // the worse error. Check sourceStatuses from a production deploy before
    // concluding otherwise.
    note: "India's largest paper",
  },
  {
    id: "ndtv",
    name: "NDTV",
    bucket: "international",
    country: "IN",
    language: "en",
    categories: ["india", "politics", "breaking"],
    rssUrl: "https://feeds.feedburner.com/ndtvnews-top-stories",
    homepageUrl: "https://www.ndtv.com",
    priority: 7,
    active: true,
    credibilityScore: 7,
    note: "Indian news network",
  },
  {
    id: "nytimes",
    name: "The New York Times",
    bucket: "international",
    country: "US",
    language: "en",
    categories: ["world", "politics", "business"],
    rssUrl: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
    homepageUrl: "https://www.nytimes.com",
    priority: 9,
    active: true,
    credibilityScore: 9,
    note: "Premier US journalism",
  },
  {
    id: "politico-eu",
    name: "Politico Europe",
    bucket: "international",
    country: "BE",
    language: "en",
    categories: ["europe", "politics", "policy"],
    rssUrl: "https://www.politico.eu/feed/",
    homepageUrl: "https://www.politico.eu",
    priority: 7,
    active: true,
    credibilityScore: 8,
    note: "EU politics coverage",
  },
  {
    id: "cnn",
    name: "CNN",
    bucket: "international",
    country: "US",
    language: "en",
    categories: ["world", "politics", "breaking"],
    rssUrl: null,
    homepageUrl: "https://www.cnn.com",
    priority: 8,
    active: false,
    // CNN RSS includes sponsored/ad content; only keep real CNN articles
    urlPrefix: "https://www.cnn.com/",
    credibilityScore: 7,
    note: "US breaking news. Feed retired: rss.cnn.com fails the TLS handshake outright and every alternate path (edition.cnn.com, www.cnn.com) is 404 (2026-07-31). CNN has withdrawn public RSS.",
  },
  {
    id: "south-china-morning-post",
    name: "South China Morning Post",
    bucket: "international",
    country: "HK",
    language: "en",
    categories: ["asia", "china", "business"],
    rssUrl: "https://www.scmp.com/rss/91/feed",
    homepageUrl: "https://www.scmp.com",
    priority: 7,
    active: true,
    credibilityScore: 7,
    note: "Asian affairs — relevant for Nepal + China coverage",
  },
  {
    id: "ap-news",
    name: "AP News",
    bucket: "international",
    country: "US",
    language: "en",
    categories: ["world", "wire"],
    rssUrl: null,
    homepageUrl: "https://apnews.com/",
    priority: 10,
    active: false, // No official free RSS
    credibilityScore: 10,
    note: "Global reporting network",
  },
  {
    id: "washington-post",
    name: "The Washington Post",
    bucket: "international",
    country: "US",
    language: "en",
    categories: ["world", "politics", "policy"],
    rssUrl: null,
    homepageUrl: "https://www.washingtonpost.com",
    priority: 8,
    active: false, // Paywalled
    credibilityScore: 9,
    note: "US policy focus",
  },
  {
    id: "wsj",
    name: "The Wall Street Journal",
    bucket: "international",
    country: "US",
    language: "en",
    categories: ["business", "markets", "politics"],
    rssUrl: null,
    homepageUrl: "https://www.wsj.com",
    priority: 7,
    active: false, // Paywalled
    credibilityScore: 9,
    note: "US business news",
  },
  {
    id: "bloomberg",
    name: "Bloomberg",
    bucket: "international",
    country: "US",
    language: "en",
    categories: ["business", "markets", "economics"],
    rssUrl: null,
    homepageUrl: "https://www.bloomberg.com",
    priority: 7,
    active: false, // No free public RSS
    credibilityScore: 9,
    note: "Global finance wire",
  },
];

/** Sources with a working RSS/Atom URL that should be fetched */
export const ACTIVE_SOURCES = SOURCES.filter(
  (s) => s.active && s.rssUrl !== null,
);

/** Backward-compatible map used by the sidebar */
export const sourceRegistry = {
  national: SOURCES.filter((s) => s.bucket === "national"),
  international: SOURCES.filter((s) => s.bucket === "international"),
};

/** Look up a source by id */
export function getSourceById(id: string): Source | undefined {
  return SOURCES.find((s) => s.id === id);
}
