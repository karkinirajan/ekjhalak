export type RangeKey = "day" | "week" | "month"
export type BucketKey = "national" | "international"

export interface NewsItem {
  id: string
  bucket: BucketKey
  title: string
  source: string
  sourceUrl: string
  publishedAt: string
  summaryEn: string
  summaryNp: string
}

export interface NewsData {
  day: {
    national: NewsItem[]
    international: NewsItem[]
  }
  week: {
    national: NewsItem[]
    international: NewsItem[]
  }
  month: {
    national: NewsItem[]
    international: NewsItem[]
  }
}

export const emptyData: NewsData = {
  day: {
    national: [],
    international: [],
  },
  week: {
    national: [],
    international: [],
  },
  month: {
    national: [],
    international: [],
  },
}
