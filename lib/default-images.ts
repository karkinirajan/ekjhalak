import { TOPICS, type TopicId } from "./taxonomy";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function resolveStoryImageSource(
  sourceImageUrl: string | null,
  topic: TopicId,
): string {
  if (sourceImageUrl) {
    try {
      const url = new URL(sourceImageUrl.trim());
      if (url.protocol === "https:") {
        return url.toString();
      }
    } catch {
      // Fall through to the generated topic cover art.
    }
  }

  return buildTopicFallbackImageDataUrl(topic);
}

const TOPIC_PALETTES: Record<TopicId, { background: string; accent: string }> = {
  breaking: { background: "#1f1a17", accent: "#f97316" },
  politics: { background: "#f7efe8", accent: "#b23a2f" },
  world: { background: "#f4efe6", accent: "#3f5d7a" },
  business: { background: "#f6f2e8", accent: "#2e6f4f" },
  sports: { background: "#eef4f0", accent: "#1d4ed8" },
  culture: { background: "#f8f1e7", accent: "#8b5e3c" },
  technology: { background: "#f2f4f8", accent: "#2563eb" },
  health: { background: "#f7f5ef", accent: "#0f766e" },
  environment: { background: "#eef7ee", accent: "#3f7d20" },
  society: { background: "#f8f4ed", accent: "#7c3aed" },
  opinion: { background: "#f7f2ea", accent: "#7a4b2f" },
};

export function buildTopicFallbackImageDataUrl(topic: TopicId): string {
  const meta = TOPICS[topic];
  const palette = TOPIC_PALETTES[topic];
  const label = escapeXml(meta.en);
  const glyph = escapeXml(meta.glyph);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800">
      <rect width="1200" height="800" rx="48" fill="${palette.background}" />
      <rect x="80" y="80" width="1040" height="640" rx="40" fill="${palette.accent}" opacity="0.14" />
      <circle cx="965" cy="240" r="180" fill="${palette.accent}" opacity="0.16" />
      <rect x="120" y="560" width="420" height="16" rx="8" fill="${palette.accent}" opacity="0.26" />
      <rect x="120" y="600" width="300" height="12" rx="6" fill="${palette.accent}" opacity="0.2" />
      <text x="120" y="310" font-family="Inter, Arial, sans-serif" font-size="64" font-weight="700" fill="${palette.accent}">${label}</text>
      <text x="120" y="420" font-family="Inter, Arial, sans-serif" font-size="180" font-weight="700" fill="${palette.accent}" opacity="0.92">${glyph}</text>
      <text x="120" y="700" font-family="Inter, Arial, sans-serif" font-size="34" font-weight="600" fill="#111111" opacity="0.78">EkJhalak</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
