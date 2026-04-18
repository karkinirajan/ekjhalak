export type Lang = "en" | "np";

const en = {
  // Top navbar controls
  searchPlaceholder: "Search headlines and summaries",
  refreshFeed: "Refresh feed",
  langButton: "EN → NP",
  langToggleLabel: "Switch to Nepali",
  themeDark: "Switch to dark theme",
  themeLight: "Switch to light theme",

  // Range & bucket filters
  statTimelineTitle: "Range",
  statFeedTitle: "Region",
  statLangTitle: "Display",
  rangeDay: "Today",
  rangeWeek: "This Week",
  rangeMonth: "This Month",
  rangeSuffix: "briefing",
  feedAll: "All",
  feedNational: "National",
  feedInternational: "International",

  // Feed chrome
  briefingDesc:
    "No clutter. No chaos. No ads. Just short, accurate news in one place.",
  filtered: "stories",

  // Pagination
  pagePre: "Page",
  pageOf: "of",
  prev: "Prev",
  next: "Next",

  // Card & detail
  readBrief: "Read brief",

  // States
  noStories: "No stories match this filter. Try a different range.",
  loadingStories: "Loading stories…",
  errorFeed: "Could not load news feed. Check your connection or try again.",
  retryLabel: "Retry",
};

export type I18nDict = typeof en;

const np: I18nDict = {
  searchPlaceholder: "शीर्षक र सारांश खोज्नुहोस्",
  refreshFeed: "फिड रिफ्रेस गर्नुहोस्",
  langButton: "NP → EN",
  langToggleLabel: "अंग्रेजीमा स्विच गर्नुहोस्",
  themeDark: "डार्क मोडमा जानुहोस्",
  themeLight: "उज्यालो मोडमा जानुहोस्",

  statTimelineTitle: "समय",
  statFeedTitle: "क्षेत्र",
  statLangTitle: "प्रदर्शन",
  rangeDay: "आजको",
  rangeWeek: "यो हप्ताको",
  rangeMonth: "यो महिनाको",
  rangeSuffix: "ब्रिफिङ",
  feedAll: "सबै",
  feedNational: "स्वदेश",
  feedInternational: "विदेश",

  briefingDesc:
    "अनावश्यक कुरा छैन, विज्ञापनको झन्झट छैन — छोटो र सही समाचार, सबै एकै ठाउँमा।",
  filtered: "खबर",

  pagePre: "पृष्ठ",
  pageOf: "/",
  prev: "अघिल्लो",
  next: "अर्को",

  readBrief: "पूरा पढ्नुहोस्",

  noStories: "तपाईंले खोज्नुभएको कुरा भेटिएन। अर्कै दायरा प्रयास गर्नुहोस्।",
  loadingStories: "समाचार लोड गर्दैछौं…",
  errorFeed:
    "समाचार लोड गर्न सकिएन। इन्टरनेट जाँच्नुहोस् वा पुनः प्रयास गर्नुहोस्।",
  retryLabel: "पुनः प्रयास",
};

export const i18n = { en, np };
