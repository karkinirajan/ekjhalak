export const LOCAL_TIMEZONE = "Asia/Kathmandu";

export const sourceRegistry = {
  national: [
    {
      name: "Routine of Nepal Banda",
      url: "https://www.instagram.com/routineofnepalbanda/",
      note: "Street-level national pulse",
    },
    {
      name: "24 Ghanta Nepal",
      url: "https://www.instagram.com/24ghantanepal/",
      note: "24-hour Nepal news coverage",
    },

    {
      name: "Nepal In Last 24 Hours",
      url: "https://www.instagram.com/nepalinlast24hours/",
      note: "Live rapid-fire Nepal updates",
    },

    {
      name: "Kathmandu Post",
      url: "https://kathmandupost.com",
      note: "National + policy + business",
    },
    {
      name: "Onlinekhabar English",
      url: "https://english.onlinekhabar.com",
      note: "Fast national updates",
    },
    {
      name: "eKantipur",
      url: "https://ekantipur.com/en",
      note: "Major Nepali newsroom",
    },
    {
      name: "Gorkhapatra",
      url: "https://www.gorkhapatraonline.com",
      note: "Historic Nepali paper",
    },
    {
      name: "RSS Nepal",
      url: "https://rssnepal.org.np/about",
      note: "National wire source",
    },
    {
      name: "The Rising Nepal",
      url: "https://risingnepaldaily.com",
      note: "English state daily",
    },
  ],
  international: [
    {
      name: "Reuters",
      url: "https://www.reuters.com/world/",
      note: "Fast global wire",
    },
    {
      name: "AP News",
      url: "https://apnews.com/",
      note: "Global reporting network",
    },
    {
      name: "Al Jazeera",
      url: "https://www.aljazeera.com/",
      note: "Strong international lens",
    },
    { name: "DW", url: "https://www.dw.com/en", note: "Europe + world" },
    {
      name: "BBC",
      url: "https://www.bbc.com/news",
      note: "Trusted global coverage",
    },
    {
      name: "The New York Times",
      url: "https://www.nytimes.com",
      note: "Premier US journalism",
    },
    {
      name: "The Hindu",
      url: "https://www.thehindu.com",
      note: "India's national daily",
    },
    {
      name: "The Times of India",
      url: "https://timesofindia.indiatimes.com",
      note: "India's largest paper",
    },
    {
      name: "NDTV",
      url: "https://www.ndtv.com",
      note: "Indian news network",
    },
    {
      name: "France 24",
      url: "https://www.france24.com",
      note: "French global news",
    },
    {
      name: "The Guardian",
      url: "https://www.theguardian.com",
      note: "UK independent voice",
    },
    {
      name: "Politico Europe",
      url: "https://www.politico.eu",
      note: "EU politics coverage",
    },
    {
      name: "CNN",
      url: "https://www.cnn.com",
      note: "US breaking news",
    },
    {
      name: "The Washington Post",
      url: "https://www.washingtonpost.com",
      note: "US policy focus",
    },
    {
      name: "The Wall Street Journal",
      url: "https://www.wsj.com",
      note: "US business news",
    },
    {
      name: "Bloomberg",
      url: "https://www.bloomberg.com",
      note: "Global finance wire",
    },
  ],
};

export const researchStack = [
  {
    name: "Brave Search",
    role: "Primary search",
    roleNp: "प्राथमिक खोज",
    note: "Fresh web and news discovery",
    noteNp: "ताजा वेब र समाचार खोज",
  },
  {
    name: "Tavily",
    role: "Fallback search",
    roleNp: "वैकल्पिक खोज",
    note: "Agent-friendly search backup",
    noteNp: "एजेन्ट-मैत्री खोज ब्याकअप",
  },
  {
    name: "Groq",
    role: "Research synthesis",
    roleNp: "अनुसन्धान संश्लेषण",
    note: "Fast ranked summarization",
    noteNp: "द्रुत क्रमाङ्कित सारांश",
  },
  {
    name: "Gemini Flash",
    role: "Summary + translation",
    roleNp: "सारांश + अनुवाद",
    note: "Bilingual summary generation",
    noteNp: "द्विभाषिक सारांश निर्माण",
  },
];

export const rangeLabels = {
  day: "Today",
  week: "This Week",
  month: "This Month",
} as const;
