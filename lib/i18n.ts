export type Lang = "en" | "np"

const en = {
  // App identity
  appTagline: "Nepal & World briefings",
  appSubtitle: "Daily newsroom",

  // Header controls
  searchPlaceholder: "Search headlines, sources, summaries",
  switchToLive: "Switch to live",
  switchToDemo: "Switch to demo",
  langButton: "EN → NP",

  // Sidebar navigation
  navOverview: "Overview",
  navToday: "Today",
  navWeek: "This Week",
  navMonth: "This Month",

  // Feed lens
  feedLensLabel: "Feed lens",
  feedAll: "National + World",
  feedNational: "Nepal only",
  feedInternational: "World only",

  // Theme
  themeLabel: "Theme",
  themeDark: "Night Ink",
  themeLight: "Paper Dusk",

  // Sidebar info
  dailyRefreshTitle: "Daily refresh",
  dailyRefreshTime: "9:00 PM",
  dailyRefreshNote: "Same trusted sources, refreshed summaries, bilingual output.",
  sourcesLabel: "Sources",

  // Source registry panel
  trustedSourcesTitle: "Trusted sources",
  trustedSourcesDesc: "Curated Nepali and world publishers",
  sectionNepal: "Nepal",
  sectionWorld: "World",

  // Research stack panel
  researchStackTitle: "Research stack",
  researchStackDesc: "Free-first pipeline for daily updates",

  // API contract panel
  apiContractTitle: "API contract",
  apiContractDesc: "Live mode will plug into this endpoint",

  // Feed
  briefingDesc: "20 stories per page, lightweight reading cards, and source-first links.",
  tabToday: "Today",
  tabWeek: "Week",
  tabMonth: "Month",
  tabEnFirst: "English first",
  tabNpFirst: "नेपाली पहिलो",

  // Range labels
  rangeDay: "Today",
  rangeWeek: "This Week",
  rangeMonth: "This Month",
  rangeSuffix: "briefing",

  // Stat cards
  statItemsTitle: "Visible items",
  statItemsNote: "Filtered and paginated for calmer reading.",
  statTimelineTitle: "Timeline",
  statTimelineNote: "Today, week, or month ranking.",
  statFeedTitle: "Feed lens",
  statFeedNote: "Split or merged reading modes.",
  statLangTitle: "Language mode",
  statLangNote: "Primary summary plus translation.",
  feedValueAll: "50 + 50",
  feedValueNational: "Nepal",
  feedValueInternational: "World",
  langValue: "EN → NP",

  // Pagination
  pagePre: "Page",
  pageOf: "of",
  prev: "Prev",
  next: "Next",

  // News card
  badgeNepal: "Nepal",
  badgeWorld: "World",
  readBrief: "Read brief",
  sourceLink: "Source",

  // Brief drawer
  langLabelEn: "English",
  langLabelNp: "नेपाली",

  // Empty state
  noStories:
    "No stories match this search. Try a different phrase and the newsroom maze will open another corridor.",

  // Status messages
  statusDemo: "Using demo data. Connect your backend to switch to live AI-researched summaries.",
  statusLoading: "Fetching live AI-prepared stories from your backend…",
  statusConnected: "Live endpoint connected. Content is ready.",
  statusUnavailable: "Live endpoint not available. Falling back to demo content.",
}

export type I18nDict = typeof en

const np: I18nDict = {
  appTagline: "नेपाल र विश्वका समाचार",
  appSubtitle: "दैनिक समाचार केन्द्र",

  searchPlaceholder: "शीर्षक, स्रोत, सारांश खोज्नुहोस्",
  switchToLive: "लाइभमा जानुहोस्",
  switchToDemo: "डेमोमा फर्कनुहोस्",
  langButton: "NP → EN",

  navOverview: "अवलोकन",
  navToday: "आज",
  navWeek: "यो हप्ता",
  navMonth: "यो महिना",

  feedLensLabel: "फिड लेन्स",
  feedAll: "राष्ट्रिय + विश्व",
  feedNational: "नेपाल मात्र",
  feedInternational: "विश्व मात्र",

  themeLabel: "थिम",
  themeDark: "Night Ink",
  themeLight: "Paper Dusk",

  dailyRefreshTitle: "दैनिक अद्यावधिक",
  dailyRefreshTime: "रात ९:००",
  dailyRefreshNote: "विश्वसनीय स्रोत, ताजा सारांश, द्विभाषिक सामग्री।",
  sourcesLabel: "स्रोतहरू",

  trustedSourcesTitle: "विश्वसनीय स्रोतहरू",
  trustedSourcesDesc: "छानिएका नेपाली र विश्व प्रकाशकहरू",
  sectionNepal: "नेपाल",
  sectionWorld: "विश्व",

  researchStackTitle: "अनुसन्धान स्ट्याक",
  researchStackDesc: "दैनिक अद्यावधिकका लागि निःशुल्क पाइपलाइन",

  apiContractTitle: "API सम्झौता",
  apiContractDesc: "लाइभ मोडले यो एन्डपोइन्ट प्रयोग गर्नेछ",

  briefingDesc: "प्रति पृष्ठ २० समाचार, हल्का पठन कार्ड, र स्रोत-प्रथम लिङ्कहरू।",
  tabToday: "आज",
  tabWeek: "हप्ता",
  tabMonth: "महिना",
  tabEnFirst: "अंग्रेजी पहिलो",
  tabNpFirst: "नेपाली पहिलो",

  rangeDay: "आज",
  rangeWeek: "यो हप्ता",
  rangeMonth: "यो महिना",
  rangeSuffix: "ब्रिफिङ",

  statItemsTitle: "देखिने समाचार",
  statItemsNote: "शान्त पठनका लागि फिल्टर र पृष्ठाङ्कन।",
  statTimelineTitle: "समयरेखा",
  statTimelineNote: "आज, हप्ता, वा महिना क्रमाङ्कन।",
  statFeedTitle: "फिड लेन्स",
  statFeedNote: "विभाजित वा मिश्रित पठन मोड।",
  statLangTitle: "भाषा मोड",
  statLangNote: "प्राथमिक सारांश र अनुवाद।",
  feedValueAll: "50 + 50",
  feedValueNational: "नेपाल",
  feedValueInternational: "विश्व",
  langValue: "NP → EN",

  pagePre: "पृष्ठ",
  pageOf: "/",
  prev: "अघिल्लो",
  next: "अर्को",

  badgeNepal: "नेपाल",
  badgeWorld: "विश्व",
  readBrief: "संक्षेप पढ्नुहोस्",
  sourceLink: "स्रोत",

  langLabelEn: "English",
  langLabelNp: "नेपाली",

  noStories: "यस खोजसँग मिल्ने कुनै समाचार छैन। अर्को शब्द प्रयास गर्नुहोस्।",

  statusDemo:
    "डेमो डेटा प्रयोग गरिँदैछ। लाइभ AI-अनुसन्धित सारांशका लागि ब्याकएन्ड जोड्नुहोस्।",
  statusLoading: "ब्याकएन्डबाट लाइभ AI समाचार ल्याइँदैछ…",
  statusConnected: "लाइभ एन्डपोइन्ट जोडिएको छ। सामग्री तयार छ।",
  statusUnavailable: "लाइभ एन्डपोइन्ट उपलब्ध छैन। डेमो सामग्रीमा फर्किँदैछ।",
}

export const i18n = { en, np }
