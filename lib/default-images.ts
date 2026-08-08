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
  technology: { background: "#f2f4f8", accent: "#2563eb" },
  health: { background: "#f7f5ef", accent: "#0f766e" },
  environment: { background: "#eef7ee", accent: "#3f7d20" },
  society: { background: "#f8f4ed", accent: "#7c3aed" },
};

/**
 * Cover art for a story whose feed shipped no photograph.
 *
 * Square, and composed from the centre outward. That is the whole design
 * constraint: this one image is cropped by `object-cover` into three different
 * shapes — a tall card column, a 16:10 rail thumbnail, and a wide reader-panel
 * header — and a crop only ever keeps the middle. The previous version was a
 * 3:2 landscape with its label set flush left at x=120, so the card column
 * sliced the label down to its last two letters and the page filled with cards
 * captioned "ss" and "cs".
 *
 * Nothing sits outside the central band any more, and the label is anchored
 * `middle` rather than positioned, so every crop keeps the topic legible.
 */
export function buildTopicFallbackImageDataUrl(topic: TopicId): string {
  const meta = TOPICS[topic];
  const palette = TOPIC_PALETTES[topic];
  const label = escapeXml(meta.en);
  const glyph = escapeXml(meta.glyph);
  // System stacks only. A data-URI SVG rendered through <img> is an isolated
  // document — it cannot reach the page's webfonts, so naming one just yields
  // whatever the platform substitutes.
  const font = "ui-sans-serif, system-ui, -apple-system, Segoe UI, Arial, sans-serif";
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800">
      <rect width="800" height="800" fill="${palette.background}" />
      <circle cx="400" cy="400" r="330" fill="${palette.accent}" opacity="0.10" />
      <circle cx="400" cy="400" r="230" fill="${palette.accent}" opacity="0.10" />
      <text x="400" y="392" text-anchor="middle" font-family="${font}" font-size="230" font-weight="700" fill="${palette.accent}" opacity="0.92">${glyph}</text>
      <text x="400" y="520" text-anchor="middle" font-family="${font}" font-size="62" font-weight="700" letter-spacing="2" fill="${palette.accent}">${label}</text>
      <rect x="310" y="566" width="180" height="6" rx="3" fill="${palette.accent}" opacity="0.32" />
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
