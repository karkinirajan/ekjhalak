// lib/news-sources.ts
// Backward-compatibility re-exports.
// New code should import directly from lib/source-registry.ts.

export {
  sourceRegistry,
  SOURCES,
  ACTIVE_SOURCES,
  getSourceById,
} from "./source-registry";
export type {
  Source,
  SourceBucket,
  SourceLanguage,
  SourceFetchStatus,
} from "./source-registry";

export const LOCAL_TIMEZONE = "Asia/Kathmandu";
