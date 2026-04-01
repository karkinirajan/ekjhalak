// lib/news-sources.ts
// Backward-compatibility re-exports.
// New code should import directly from lib/source-registry.ts.

export {
  sourceRegistry,
  SOURCES,
  ACTIVE_SOURCES,
  getSourceById,
} from "./source-registry"
export type { Source, SourceBucket, SourceLanguage, SourceFetchStatus } from "./source-registry"

export const LOCAL_TIMEZONE = "Asia/Kathmandu"

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
]

export const rangeLabels = {
  day: "Today",
  week: "This Week",
  month: "This Month",
} as const
