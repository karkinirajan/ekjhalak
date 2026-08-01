export type Lang = "en" | "np";

const en = {
  // ── Masthead ───────────────────────────────────────────────────────────────
  wordmark: "EkJhalak",
  wordmarkNp: "एक झलक",
  tagline: "Nepal & World, at a glance",
  searchPlaceholder: "Search headlines and summaries",
  searchLabel: "Search",
  refreshFeed: "Refresh feed",
  langButton: "नेपाली",
  langToggleLabel: "Switch to Nepali",
  themeDark: "Switch to dark theme",
  themeLight: "Switch to light theme",
  openMenu: "Open menu",
  closeMenu: "Close menu",

  // ── Ticker ─────────────────────────────────────────────────────────────────
  liveLabel: "Live",
  updatedAt: "Updated",

  // ── Filters ────────────────────────────────────────────────────────────────
  statTimelineTitle: "Range",
  statFeedTitle: "Region",
  rangeDay: "Today",
  rangeWeek: "This Week",
  rangeMonth: "This Month",
  rangeSuffix: "briefing",
  feedAll: "Top Stories",
  feedNational: "Nepal",
  feedInternational: "World",
  allTopics: "All",
  clearFilters: "Clear filters",

  // ── Sections ───────────────────────────────────────────────────────────────
  leadStory: "Lead story",
  moreHeadlines: "More headlines",
  latestSection: "Latest",
  trendingSection: "Worth your time",
  trendingHint: "Ranked by newsroom coverage, source weight and freshness",
  briefingDesc:
    "No clutter. No chaos. No ads. Just short, accurate news in one place.",
  filtered: "stories",

  // ── Story metadata ─────────────────────────────────────────────────────────
  readBrief: "Read brief",
  readFull: "Read at source",
  outletsOne: "1 outlet",
  outletsMany: "outlets covering",
  minRead: "min read",

  // ── Newsletter ─────────────────────────────────────────────────────────────
  newsletterKicker: "The daily brief",
  newsletterTitle: "One email. Every morning. Nothing else.",
  newsletterDesc:
    "A short digest of what mattered in Nepal and the world, in your inbox before your first cup of tea.",
  newsletterPlaceholder: "you@example.com",
  newsletterCta: "Subscribe",
  newsletterSuccess: "You're on the list. Watch your inbox tomorrow morning.",
  newsletterInvalid: "Please enter a valid email address.",
  newsletterUnavailable:
    "Signups aren't open yet — the briefing list is still being set up.",
  newsletterFailed: "Something went wrong. Please try again in a moment.",
  newsletterPrivacy: "No spam. Unsubscribe any time.",
  subscribe: "Subscribe",
  close: "Close",

  // ── Pagination ─────────────────────────────────────────────────────────────
  pagePre: "Page",
  pageOf: "of",
  prev: "Previous",
  next: "Next",

  // ── Footer ─────────────────────────────────────────────────────────────────
  footerAbout: "About",
  footerAboutText:
    "EkJhalak aggregates trusted Nepali and international newsrooms into one calm, ad-free briefing. Summaries stay in the language they were published in.",
  footerSections: "Sections",
  footerSources: "Sources",
  footerSourcesText: "Reading from",
  footerNewsrooms: "newsrooms",
  footerRights: "All rights reserved.",
  footerBuiltBy: "Built by",
  footerDisclaimer:
    "Headlines and summaries belong to their original publishers. Every story links back to its source.",

  // ── States ─────────────────────────────────────────────────────────────────
  noStories: "No stories match this filter. Try a different range or topic.",
  loadingStories: "Loading stories…",
  errorFeed: "Could not load news feed. Check your connection or try again.",
  retryLabel: "Retry",
};

export type I18nDict = typeof en;

const np: I18nDict = {
  wordmark: "एक झलक",
  wordmarkNp: "EkJhalak",
  tagline: "नेपाल र विश्व, एकै झलकमा",
  searchPlaceholder: "शीर्षक र सारांश खोज्नुहोस्",
  searchLabel: "खोज्नुहोस्",
  refreshFeed: "फिड रिफ्रेस गर्नुहोस्",
  langButton: "English",
  langToggleLabel: "अंग्रेजीमा स्विच गर्नुहोस्",
  themeDark: "डार्क मोडमा जानुहोस्",
  themeLight: "उज्यालो मोडमा जानुहोस्",
  openMenu: "मेनु खोल्नुहोस्",
  closeMenu: "मेनु बन्द गर्नुहोस्",

  liveLabel: "प्रत्यक्ष",
  updatedAt: "अद्यावधिक",

  statTimelineTitle: "समय",
  statFeedTitle: "क्षेत्र",
  rangeDay: "आजको",
  rangeWeek: "यो हप्ताको",
  rangeMonth: "यो महिनाको",
  rangeSuffix: "ब्रिफिङ",
  feedAll: "मुख्य समाचार",
  feedNational: "स्वदेश",
  feedInternational: "विश्व",
  allTopics: "सबै",
  clearFilters: "फिल्टर हटाउनुहोस्",

  leadStory: "मुख्य समाचार",
  moreHeadlines: "थप शीर्षक",
  latestSection: "पछिल्लो",
  trendingSection: "पढ्नै पर्ने",
  trendingHint: "सञ्चारगृहको समेटाइ, स्रोतको भार र नयाँपनका आधारमा",
  briefingDesc:
    "अनावश्यक कुरा छैन, विज्ञापनको झन्झट छैन — छोटो र सही समाचार, सबै एकै ठाउँमा।",
  filtered: "खबर",

  readBrief: "पूरा पढ्नुहोस्",
  readFull: "स्रोतमा पढ्नुहोस्",
  outletsOne: "१ सञ्चारगृह",
  outletsMany: "सञ्चारगृहले समेटे",
  minRead: "मिनेट",

  newsletterKicker: "दैनिक ब्रिफिङ",
  newsletterTitle: "एउटा इमेल। हरेक बिहान। अरू केही होइन।",
  newsletterDesc:
    "नेपाल र विश्वमा के महत्त्वपूर्ण भयो — छोटो सारांश, बिहानको चिया अघि नै तपाईंको इनबक्समा।",
  newsletterPlaceholder: "you@example.com",
  newsletterCta: "सदस्यता लिनुहोस्",
  newsletterSuccess: "धन्यवाद! भोलि बिहान इनबक्स हेर्नुहोला।",
  newsletterInvalid: "कृपया मान्य इमेल ठेगाना राख्नुहोस्।",
  newsletterUnavailable:
    "अहिले दर्ता खुला छैन — ब्रिफिङ सूची तयारीकै क्रममा छ।",
  newsletterFailed: "केही गडबड भयो। केही बेरपछि पुनः प्रयास गर्नुहोस्।",
  newsletterPrivacy: "स्प्याम छैन। जुनसुकै बेला बन्द गर्न सक्नुहुन्छ।",
  subscribe: "सदस्यता",
  close: "बन्द गर्नुहोस्",

  pagePre: "पृष्ठ",
  pageOf: "/",
  prev: "अघिल्लो",
  next: "अर्को",

  footerAbout: "हाम्रो बारेमा",
  footerAboutText:
    "एक झलकले भरपर्दा नेपाली र अन्तर्राष्ट्रिय सञ्चारगृहका समाचार एकै ठाउँमा, विज्ञापनरहित रूपमा प्रस्तुत गर्छ। सारांश प्रकाशित भएकै भाषामा राखिन्छ।",
  footerSections: "विषय",
  footerSources: "स्रोत",
  footerSourcesText: "हाल",
  footerNewsrooms: "सञ्चारगृहबाट",
  footerRights: "सर्वाधिकार सुरक्षित।",
  footerBuiltBy: "निर्माता",
  footerDisclaimer:
    "शीर्षक र सारांशको अधिकार सम्बन्धित प्रकाशकको हो। हरेक समाचार आफ्नै स्रोतमा जोडिएको छ।",

  noStories: "यो फिल्टरमा कुनै समाचार भेटिएन। अर्कै दायरा वा विषय हेर्नुहोस्।",
  loadingStories: "समाचार लोड गर्दैछौं…",
  errorFeed:
    "समाचार लोड गर्न सकिएन। इन्टरनेट जाँच्नुहोस् वा पुनः प्रयास गर्नुहोस्।",
  retryLabel: "पुनः प्रयास",
};

export const i18n = { en, np };
