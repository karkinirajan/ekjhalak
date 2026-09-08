export type Lang = "en" | "np";

const en = {
  // ── Masthead ───────────────────────────────────────────────────────────────
  wordmark: "EkJhalak",
  wordmarkNp: "एक झलक",
  // Short on purpose. The field is narrow at every width the masthead gives it,
  // and a placeholder that gets clipped mid-word reads as a broken control.
  searchPlaceholder: "Search for…",
  searchLabel: "Search headlines and summaries",
  refreshFeed: "Refresh feed",
  langButton: "नेपाली",
  langToggleLabel: "Switch to Nepali",

  // ── Ticker ─────────────────────────────────────────────────────────────────
  liveLabel: "Live",

  rangeDay: "Today",
  rangeWeek: "This Week",
  rangeMonth: "This Month",
  feedAll: "Top Stories",
  feedNational: "Nepal",
  feedInternational: "World",
  allTopics: "All",
  clearFilters: "Clear filters",

  // ── Sections ───────────────────────────────────────────────────────────────
  latestSection: "Latest",
  trendingSection: "Worth your time",
  trendingHint: "Ranked by newsroom coverage, source weight and freshness",
  filtered: "stories",

  readFull: "Read at source",
  excerptNotice: "A short excerpt — EkJhalak links out rather than reproducing other newsrooms' work.",
  outletsMany: "outlets covering",
  minRead: "min read",
  translatedNotice: "Machine translated",

  // ── Newsletter ─────────────────────────────────────────────────────────────
  newsletterKicker: "The daily brief",
  newsletterTitle: "One email. Every morning. Nothing else.",
  newsletterDesc:
    "A short digest of what mattered in Nepal and the world, in your inbox before your first cup of tea.",
  newsletterPlaceholder: "you@example.com",
  newsletterCta: "Subscribe",
  newsletterSending: "Sending",
  newsletterCheckInbox:
    "Check your inbox — we've sent a link to confirm. You're not on the list until you click it, and the link lasts two days.",
  newsletterSuccess: "You're on the list. Watch your inbox tomorrow morning.",
  newsletterInvalid: "Please enter a valid email address.",
  newsletterThrowaway:
    "That looks like a disposable address. Please use one you'll still read tomorrow.",
  newsletterBusy: "Too many attempts. Please try again in a few minutes.",
  newsletterUnavailable:
    "Signups aren't open yet — the briefing list is still being set up.",
  newsletterFailed: "Something went wrong. Please try again in a moment.",
  newsletterPrivacy: "No spam. Unsubscribe any time.",
  subscribe: "Subscribe",

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
  topicNav: "Topics",
  footerSourcesText: "Reading from",
  footerNewsrooms: "newsrooms",
  footerRights: "All rights reserved.",
  footerBuiltBy: "Built by",
  footerDisclaimer:
    "Headlines and summaries belong to their original publishers. Every story links back to its source.",
  footerCompany: "Publication",
  navAbout: "About",
  navEditorial: "Editorial standards",
  navPrivacy: "Privacy",
  navTerms: "Terms",
  navContact: "Contact",
  backToNews: "Back to the news",

  // ── States ─────────────────────────────────────────────────────────────────
  noStories: "No stories match this filter. Try a different range or topic.",
  errorFeed: "Could not load news feed. Check your connection or try again.",
  retryLabel: "Retry",
};

export type I18nDict = typeof en;

const np: I18nDict = {
  wordmark: "एक झलक",
  wordmarkNp: "EkJhalak",
  searchPlaceholder: "खोज्नुहोस्…",
  searchLabel: "शीर्षक र सारांश खोज्नुहोस्",
  refreshFeed: "फिड रिफ्रेस गर्नुहोस्",
  langButton: "English",
  langToggleLabel: "अंग्रेजीमा स्विच गर्नुहोस्",

  liveLabel: "प्रत्यक्ष",

  rangeDay: "आजको",
  rangeWeek: "यो हप्ताको",
  rangeMonth: "यो महिनाको",
  feedAll: "मुख्य समाचार",
  feedNational: "स्वदेश",
  feedInternational: "विश्व",
  allTopics: "सबै",
  clearFilters: "फिल्टर हटाउनुहोस्",

  latestSection: "पछिल्लो",
  trendingSection: "पढ्नै पर्ने",
  trendingHint: "सञ्चारगृहको समेटाइ, स्रोतको भार र नयाँपनका आधारमा",
  filtered: "खबर",

  readFull: "स्रोतमा पढ्नुहोस्",
  excerptNotice: "छोटो अंश मात्र — एक झलकले अरू समाचारकक्षको सामग्री नक्कल नगरी स्रोतमै पठाउँछ।",
  outletsMany: "सञ्चारगृहले समेटे",
  minRead: "मिनेट",
  translatedNotice: "मेसिन अनुवाद",

  newsletterKicker: "दैनिक ब्रिफिङ",
  newsletterTitle: "एउटा इमेल, सम्पूर्ण महत्त्वपूर्ण समाचारका साथ।",
  newsletterDesc:
    "नेपाल र विश्वमा के महत्त्वपूर्ण भयो — छोटो सारांश, बिहानको चिया अघि नै तपाईंको इनबक्समा।",
  newsletterPlaceholder: "you@example.com",
  newsletterCta: "सदस्यता लिनुहोस्",
  newsletterSending: "पठाउँदै",
  newsletterCheckInbox:
    "इनबक्स हेर्नुहोस् — पुष्टि गर्ने लिंक पठाइएको छ। त्यो नथिचेसम्म तपाईं सूचीमा पर्नुहुन्न, र लिंक दुई दिनसम्म चल्छ।",
  newsletterSuccess: "धन्यवाद! भोलि बिहान इनबक्स हेर्नुहोला।",
  newsletterInvalid: "कृपया मान्य इमेल ठेगाना राख्नुहोस्।",
  newsletterThrowaway:
    "यो अस्थायी इमेल ठेगाना जस्तो देखिन्छ। कृपया भोलि पनि पढ्ने ठेगाना राख्नुहोस्।",
  newsletterBusy: "धेरै पटक प्रयास भयो। केही मिनेटपछि पुनः प्रयास गर्नुहोस्।",
  newsletterUnavailable:
    "अहिले दर्ता खुला छैन — ब्रिफिङ सूची तयारीकै क्रममा छ।",
  newsletterFailed: "केही गडबड भयो। केही बेरपछि पुनः प्रयास गर्नुहोस्।",
  newsletterPrivacy: "स्प्याम छैन। जुनसुकै बेला बन्द गर्न सक्नुहुन्छ।",
  subscribe: "सदस्यता",

  pagePre: "पृष्ठ",
  pageOf: "/",
  prev: "अघिल्लो",
  next: "अर्को",

  footerAbout: "हाम्रो बारेमा",
  footerAboutText:
    "एक झलकले भरपर्दा नेपाली र अन्तर्राष्ट्रिय सञ्चारगृहका समाचार एकै ठाउँमा, विज्ञापनरहित रूपमा प्रस्तुत गर्छ। सारांश प्रकाशित भएकै भाषामा राखिन्छ।",
  footerSections: "विषय",
  topicNav: "विषयहरू",
  footerSourcesText: "हाल",
  footerNewsrooms: "सञ्चारगृहबाट",
  footerRights: "सर्वाधिकार सुरक्षित।",
  footerBuiltBy: "निर्माता",
  footerDisclaimer:
    "शीर्षक र सारांशको अधिकार सम्बन्धित प्रकाशकको हो। हरेक समाचार आफ्नै स्रोतमा जोडिएको छ।",
  footerCompany: "प्रकाशन",
  navAbout: "हाम्रो बारेमा",
  navEditorial: "सम्पादकीय मापदण्ड",
  navPrivacy: "गोपनीयता",
  navTerms: "सर्तहरू",
  navContact: "सम्पर्क",
  backToNews: "समाचारमा फर्कनुहोस्",

  noStories: "यो फिल्टरमा कुनै समाचार भेटिएन। अर्कै दायरा वा विषय हेर्नुहोस्।",
  errorFeed:
    "समाचार लोड गर्न सकिएन। इन्टरनेट जाँच्नुहोस् वा पुनः प्रयास गर्नुहोस्।",
  retryLabel: "पुनः प्रयास",
};

export const i18n = { en, np };
