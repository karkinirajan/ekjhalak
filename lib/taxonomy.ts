// lib/taxonomy.ts
// Colour-coded editorial topic system.
//
// Sources only tell us their broad beat ("politics", "world"), which is too
// coarse to colour-code a feed — a Kathmandu Post story could be a budget
// bill or a cricket final. So we classify per article from its own words,
// in both English and Nepali, and fall back to the source's declared beats.
//
// Every topic maps to a CSS custom property defined in globals.css, which
// carries a light and a dark value. Components read `var(--topic)` after the
// wrapper sets `data-topic`, so no component ever branches on topic name.

export type TopicId =
  | "breaking"
  | "politics"
  | "world"
  | "business"
  | "sports"
  | "culture"
  | "technology"
  | "health"
  | "environment"
  | "society"
  | "opinion";

export interface Topic {
  id: TopicId;
  en: string;
  np: string;
  /** Glyph used in generated cover art when a story has no photo */
  glyph: string;
}

export const TOPICS: Record<TopicId, Topic> = {
  breaking: { id: "breaking", en: "Breaking", np: "ताजा", glyph: "⚡" },
  politics: { id: "politics", en: "Politics", np: "राजनीति", glyph: "⚖" },
  world: { id: "world", en: "World", np: "विश्व", glyph: "🌐" },
  business: { id: "business", en: "Business", np: "अर्थतन्त्र", glyph: "📈" },
  sports: { id: "sports", en: "Sports", np: "खेलकुद", glyph: "🏆" },
  culture: { id: "culture", en: "Culture", np: "कला", glyph: "🎭" },
  technology: { id: "technology", en: "Tech", np: "प्रविधि", glyph: "⌘" },
  health: { id: "health", en: "Health", np: "स्वास्थ्य", glyph: "✚" },
  environment: {
    id: "environment",
    en: "Environment",
    np: "वातावरण",
    glyph: "🌿",
  },
  society: { id: "society", en: "Society", np: "समाज", glyph: "◉" },
  opinion: { id: "opinion", en: "Opinion", np: "विचार", glyph: "✎" },
};

/** Display order for the category navigation rail. */
export const TOPIC_ORDER: TopicId[] = [
  "politics",
  "world",
  "business",
  "society",
  "sports",
  "culture",
  "technology",
  "health",
  "environment",
  "opinion",
];

export function topicLabel(id: TopicId, lang: "en" | "np"): string {
  return lang === "np" ? TOPICS[id].np : TOPICS[id].en;
}

// ── Classification ───────────────────────────────────────────────────────────
//
// Keyword lists are deliberately ordered most-specific-beat-first in
// TOPIC_MATCHERS: a story mentioning both "election" and "economy" should read
// as politics, not business. Nepali terms are matched as substrings because
// Devanagari inflects with attached postpositions (खेलमा, निर्वाचनको), which a
// word-boundary regex would miss.

interface Matcher {
  id: TopicId;
  /** Lowercased English keywords, matched on word boundaries */
  en: string[];
  /** Devanagari stems, matched as substrings */
  np: string[];
}

const TOPIC_MATCHERS: Matcher[] = [
  {
    id: "sports",
    en: [
      "cricket", "football", "soccer", "olympic", "olympics", "world cup",
      "tournament", "match", "goal", "striker", "fifa", "icc", "nba", "nfl",
      "tennis", "wicket", "innings", "medal", "athlete", "marathon",
      "championship", "league", "volleyball", "badminton", "sprint",
    ],
    np: [
      "खेल", "क्रिकेट", "फुटबल", "ओलम्पिक", "खेलाडी", "प्रतियोगिता", "गोल",
      "पदक", "विश्वकप", "टोली",
    ],
  },
  {
    id: "health",
    en: [
      "hospital", "vaccine", "vaccination", "outbreak", "epidemic", "pandemic",
      "disease", "virus", "dengue", "cholera", "malaria", "covid", "patients",
      "surgery", "doctors", "healthcare", "clinic", "mental health",
      "nutrition", "cancer", "infection", "who",
    ],
    np: [
      "स्वास्थ्य", "अस्पताल", "खोप", "महामारी", "रोग", "बिरामी", "उपचार",
      "डेंगु", "संक्रमण", "औषधि",
    ],
  },
  {
    id: "environment",
    en: [
      "climate", "glacier", "monsoon", "flood", "landslide", "earthquake",
      "wildfire", "pollution", "emissions", "deforestation", "biodiversity",
      "wildlife", "conservation", "drought", "air quality", "everest",
      "himalaya", "himalayan", "carbon", "renewable", "solar",
    ],
    np: [
      "जलवायु", "वातावरण", "बाढी", "पहिरो", "भूकम्प", "प्रदूषण", "हिमाल",
      "हिमताल", "वन", "जंगल", "वन्यजन्तु", "मनसुन", "खडेरी",
    ],
  },
  {
    id: "technology",
    en: [
      "artificial intelligence", "ai", "software", "startup", "semiconductor",
      "chip", "smartphone", "internet", "cyber", "cybersecurity", "data breach",
      "app", "google", "apple", "microsoft", "openai", "satellite", "spacecraft",
      "digital", "algorithm", "crypto", "bitcoin", "robot", "5g",
    ],
    np: [
      "प्रविधि", "इन्टरनेट", "मोबाइल", "डिजिटल", "साइबर", "सफ्टवेयर",
      "कृत्रिम बुद्धिमत्ता",
    ],
  },
  {
    id: "business",
    en: [
      "economy", "economic", "inflation", "gdp", "budget", "tax", "trade",
      "export", "import", "market", "markets", "stock", "shares", "investors",
      "investment", "bank", "banking", "rupee", "dollar", "revenue", "tariff",
      "remittance", "loan", "interest rate", "imf", "world bank", "fiscal",
      "profit", "merger", "tourism",
    ],
    np: [
      "अर्थतन्त्र", "बजेट", "कर", "व्यापार", "बजार", "शेयर", "बैंक",
      "लगानी", "मुद्रास्फीति", "राजस्व", "निर्यात", "आयात", "रेमिट्यान्स",
      "पर्यटन", "आर्थिक",
    ],
  },
  {
    id: "politics",
    en: [
      "election", "elections", "parliament", "minister", "prime minister",
      "president", "cabinet", "government", "coalition", "party", "lawmakers",
      "senate", "congress", "vote", "voters", "policy", "bill", "constitution",
      "diplomacy", "sanctions", "ambassador", "protest", "impeachment",
      "referendum", "opposition", "mayor", "governor", "treaty",
    ],
    np: [
      "राजनीति", "निर्वाचन", "संसद", "मन्त्री", "प्रधानमन्त्री", "राष्ट्रपति",
      "सरकार", "मन्त्रिपरिषद", "दल", "गठबन्धन", "मतदान", "संविधान", "अध्यादेश",
      "सांसद", "विपक्षी", "कूटनीति",
    ],
  },
  {
    id: "culture",
    en: [
      "festival", "film", "movie", "cinema", "music", "concert", "album",
      "art", "artist", "museum", "heritage", "literature", "novel", "poet",
      "theatre", "theater", "dance", "temple", "tradition", "actor", "actress",
      "exhibition", "award",
    ],
    np: [
      "संस्कृति", "चाडपर्व", "पर्व", "दशैं", "तिहार", "फिल्म", "चलचित्र",
      "संगीत", "कला", "कलाकार", "साहित्य", "मन्दिर", "सम्पदा", "परम्परा",
      "नृत्य",
    ],
  },
  {
    id: "opinion",
    en: [
      "opinion", "editorial", "commentary", "analysis", "viewpoint",
      "column", "op-ed", "perspective",
    ],
    np: ["विचार", "सम्पादकीय", "टिप्पणी", "विश्लेषण", "दृष्टिकोण"],
  },
  {
    id: "society",
    en: [
      "school", "schools", "university", "students", "education", "teachers",
      "women", "children", "caste", "migrant", "migration", "labour", "labor",
      "poverty", "welfare", "crime", "police", "court", "arrest", "trafficking",
      "rights", "community", "village", "housing",
    ],
    np: [
      "समाज", "विद्यालय", "विश्वविद्यालय", "विद्यार्थी", "शिक्षा", "शिक्षक",
      "महिला", "बालबालिका", "प्रहरी", "अदालत", "पक्राउ", "अपराध", "गरिबी",
      "श्रमिक", "अधिकार", "समुदाय",
    ],
  },
  {
    id: "world",
    en: [
      "united nations", "nato", "war", "ceasefire", "conflict", "refugees",
      "border", "military", "troops", "airstrike", "summit", "global",
      "international", "foreign", "bilateral", "gaza", "ukraine", "russia",
      "china", "india", "washington", "beijing", "brussels", "delhi",
    ],
    np: [
      "अन्तर्राष्ट्रिय", "विश्व", "युद्ध", "शरणार्थी", "सीमा", "सेना",
      "वार्ता", "विदेश", "संयुक्त राष्ट्र",
    ],
  },
];

/** Source-declared beats → topic. Used as a fallback when text is inconclusive. */
const SOURCE_CATEGORY_MAP: Record<string, TopicId> = {
  politics: "politics",
  government: "politics",
  policy: "politics",
  breaking: "breaking",
  business: "business",
  markets: "business",
  economics: "business",
  development: "business",
  society: "society",
  street: "society",
  opinion: "opinion",
  world: "world",
  conflict: "world",
  europe: "world",
  asia: "world",
  china: "world",
  india: "world",
  wire: "world",
  national: "politics",
};

const BREAKING_MARKERS =
  /\b(breaking|just in|live updates?|developing)\b|ताजा अपडेट|भर्खरै/i;

/** Build a word-boundary regex for a keyword list, cached per matcher. */
const enPatterns = new Map<TopicId, RegExp>();
for (const matcher of TOPIC_MATCHERS) {
  const escaped = matcher.en.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  enPatterns.set(matcher.id, new RegExp(`\\b(${escaped.join("|")})\\b`, "i"));
}

function scoreTopic(matcher: Matcher, haystack: string): number {
  let score = 0;

  const pattern = enPatterns.get(matcher.id);
  if (pattern?.test(haystack)) score += 2;

  for (const stem of matcher.np) {
    if (haystack.includes(stem)) {
      score += 2;
      break;
    }
  }

  return score;
}

/**
 * Assigns an editorial topic to a story.
 *
 * The headline is weighted double the summary — a headline word is a much
 * stronger signal of what a story is *about* than a word buried in body copy.
 * Ties break toward the earlier matcher, which is why TOPIC_MATCHERS is
 * ordered specific-beat-first.
 */
export function classifyTopic(
  title: string,
  summary: string,
  sourceCategories: readonly string[] = [],
): TopicId {
  const headline = title.toLowerCase();
  const body = summary.toLowerCase();

  let best: TopicId | null = null;
  let bestScore = 0;

  for (const matcher of TOPIC_MATCHERS) {
    const score =
      scoreTopic(matcher, headline) * 2 + scoreTopic(matcher, body);
    if (score > bestScore) {
      bestScore = score;
      best = matcher.id;
    }
  }

  if (best && bestScore >= 4) {
    // A "breaking" marker outranks the beat only when the story is also fresh,
    // which the caller decides — here we just surface the strong beat match.
    return best;
  }

  for (const category of sourceCategories) {
    const mapped = SOURCE_CATEGORY_MAP[category.toLowerCase()];
    if (mapped) return mapped;
  }

  return best ?? "world";
}

/** True when the headline itself is flagged as breaking by the publisher. */
export function looksBreaking(title: string): boolean {
  return BREAKING_MARKERS.test(title);
}
