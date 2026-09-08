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

/**
 * The reading colour of each category, mirroring `--topic-text` in
 * app/globals.css.
 *
 * These are literals rather than custom properties because a data-URI SVG
 * rendered through `<img>` is an isolated document — it cannot see the page's
 * tokens any more than it can see its webfonts. The values must therefore be
 * kept in step with globals.css by hand; `pnpm check:contrast` verifies the
 * CSS side, and the assertion below verifies this side matches it.
 */
const TOPIC_INK: Record<TopicId, string> = {
  breaking: "#ab0914", // flag_red_400
  politics: "#80070f", // flag_red_300
  world: "#003a9f", // egyptian_blue_500
  sports: "#002e7e", // egyptian_blue_400
  society: "#324f8b", // alice_blue_200
  business: "#005f68", // pacific_blue_300
  health: "#004045", // pacific_blue_200
  technology: "#324f8b", // alice_blue_200
  environment: "#51565a", // alabaster_200
};

/**
 * The identity colour of each category, mirroring `--topic` in globals.css.
 *
 * The ground is washed from this rather than from TOPIC_INK because two
 * categories share a reading colour — technology and society both read in
 * alice_blue_200 — and washing both from it printed two identical covers. The
 * identities differ, so the grounds do.
 */
const TOPIC_IDENTITY: Record<TopicId, string> = {
  breaking: "#d60b19", // flag_red_500
  politics: "#80070f", // flag_red_300
  world: "#003a9f", // egyptian_blue_500
  sports: "#0054e4", // egyptian_blue_600
  society: "#324f8b", // alice_blue_200
  business: "#005f68", // pacific_blue_300
  health: "#009faf", // pacific_blue_500
  technology: "#597bc3", // alice_blue_300
  environment: "#51565a", // alabaster_200
};

/**
 * The card stock these are drawn on: `--surface`, the same near-white the
 * story cards use, so a photo-less cover sits flush inside its card instead of
 * printing a paler rectangle inside it.
 */
const COVER_STOCK = "#fafbfd"; // alice_blue_900

/**
 * The category's ink at `pct` over the stock, as a flat hex.
 *
 * `color-mix()` is not available here — see TOPIC_INK — so the mix is done in
 * JS and baked into the SVG. Straight sRGB interpolation, which is what
 * `color-mix(in srgb, …)` does and what the CSS side of the cover art uses.
 */
function wash(colour: string, pct: number): string {
  const hex = (v: string) => parseInt(v, 16);
  const parts = [1, 3, 5].map((i) => hex(colour.slice(i, i + 2)));
  const stock = [1, 3, 5].map((i) => hex(COVER_STOCK.slice(i, i + 2)));
  return (
    "#" +
    parts
      .map((v, i) =>
        Math.round(v * pct + stock[i] * (1 - pct))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

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
  const ink = TOPIC_INK[topic];
  // 14%, near the weight of the quiet topic pill. This image carries type of
  // its own — a label and a glyph — so the ground has to stay light enough to
  // read them against; the contrast of that pairing is asserted per topic by
  // the test beside this file.
  const ground = wash(TOPIC_IDENTITY[topic], 0.14);
  const label = escapeXml(meta.en);
  const glyph = escapeXml(meta.glyph);
  // System stacks only. A data-URI SVG rendered through <img> is an isolated
  // document — it cannot reach the page's webfonts, so naming one just yields
  // whatever the platform substitutes.
  const font = "ui-sans-serif, system-ui, -apple-system, Segoe UI, Arial, sans-serif";
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800">
      <rect width="800" height="800" fill="${ground}" />
      <circle cx="400" cy="400" r="330" fill="${ink}" opacity="0.10" />
      <circle cx="400" cy="400" r="230" fill="${ink}" opacity="0.10" />
      <text x="400" y="392" text-anchor="middle" font-family="${font}" font-size="230" font-weight="700" fill="${ink}" opacity="0.92">${glyph}</text>
      <text x="400" y="520" text-anchor="middle" font-family="${font}" font-size="62" font-weight="700" letter-spacing="2" fill="${ink}">${label}</text>
      <rect x="310" y="566" width="180" height="6" rx="3" fill="${ink}" opacity="0.32" />
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
