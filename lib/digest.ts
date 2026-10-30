// lib/digest.ts
// The daily digest: which stories go in it, and what the email looks like.
//
// Pure on purpose — no database, no mail transport, no environment — so the two
// rules that matter can be tested in the project's plain-Node runner: which
// stories are chosen, and that nothing a publisher wrote can break out of the
// markup it is placed in. Fetching stories, claiming recipients and sending live
// in lib/digest-store.ts and lib/digest-run.ts.

import type { Lang } from "./i18n";
import type { NewsItem, OriginalLang } from "./news-pipeline";
import { langAttr, storyText } from "./story-text";
import { topicLabel } from "./taxonomy";
import { truncate } from "./utils";

/** How far back a digest reaches. */
export const DIGEST_WINDOW_HOURS = 24;

/** The reader's day, which is Nepal's, whatever timezone the server runs in. */
const TIME_ZONE = "Asia/Kathmandu";

export interface DigestStories {
  national: NewsItem[];
  international: NewsItem[];
}

/**
 * The stories one digest carries.
 *
 * Ranked by how many outlets ran the story, then by recency — coverage is the
 * only editorial signal this archive has that is not invented, and it is the one
 * the trending rail already uses. The cut is made on the overall ranking and the
 * result is split into Nepal and World afterwards, so the order inside each
 * section is still the ranking and a quiet day for one of them shows as a short
 * section instead of being padded from the other.
 *
 * Ties break on id so the same input always produces the same email, which is
 * what makes a retried send identical to the one it replaces.
 */
export function pickStories(items: NewsItem[], max: number): DigestStories {
  const ranked = [...items].sort(
    (a, b) =>
      b.coverageCount - a.coverageCount ||
      b.publishedTimestamp - a.publishedTimestamp ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );

  const top = ranked.slice(0, Math.max(0, max));
  return {
    national: top.filter((item) => item.bucket === "national"),
    international: top.filter((item) => item.bucket === "international"),
  };
}

export function countStories(stories: DigestStories): number {
  return stories.national.length + stories.international.length;
}

/**
 * The digest's date as `YYYY-MM-DD` in Nepal time.
 *
 * It is the key the delivery ledger is written under, so it has to be the same
 * for every run that belongs to one morning's digest and change exactly once a
 * day. Nepal is UTC+5:45, so a UTC date would flip at 5:45 in the morning — in
 * the middle of the send window.
 */
export function digestDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function displayDate(now: Date, lang: Lang): string {
  return new Intl.DateTimeFormat(lang === "np" ? "ne-NP" : "en-GB", {
    timeZone: TIME_ZONE,
    dateStyle: "full",
  }).format(now);
}

interface DigestCopy {
  brand: string;
  subject: (date: string) => string;
  heading: string;
  national: string;
  international: string;
  coverage: (n: number) => string;
  openSite: string;
  reason: string;
  unsubscribe: string;
}

const COPY: Record<Lang, DigestCopy> = {
  en: {
    brand: "EkJhalak",
    subject: (date) => `EkJhalak daily brief — ${date}`,
    heading: "The last 24 hours",
    national: "Nepal",
    international: "World",
    coverage: (n) => `${n} outlets`,
    openSite: "Read more on EkJhalak",
    reason: "You are receiving this because you subscribed to the EkJhalak daily brief.",
    unsubscribe: "Unsubscribe",
  },
  np: {
    brand: "एक झलक",
    subject: (date) => `एक झलक दैनिक ब्रिफिङ — ${date}`,
    heading: "विगत २४ घण्टा",
    national: "नेपाल",
    international: "विश्व",
    coverage: (n) => `${n} सञ्चारमाध्यम`,
    openSite: "एक झलकमा थप पढ्नुहोस्",
    reason: "तपाईंले एक झलकको दैनिक ब्रिफिङमा सदस्यता लिनुभएकाले यो इमेल पठाइएको हो।",
    unsubscribe: "सदस्यता हटाउनुहोस्",
  },
};

/**
 * Escape text for an HTML body or a quoted attribute.
 *
 * Every headline and summary here was written by somebody else and scraped from
 * a feed, so each is escaped on the way in, quotes included because the same
 * function serves attribute values. Nothing else in this module builds markup
 * from a string it did not write.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Same palette and inline-style approach as the confirmation email in
// lib/newsletter.ts, for the same reason: an email client has neither custom
// properties nor a stylesheet it will honour.
//
//   #e6ebf6  wrapper        #d60b19  wordmark and accents
//   #ffffff  card           #192746  body type
//   #d3d5d7  hairline       #51565a  secondary type
const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,'Noto Sans Devanagari',sans-serif";

export interface RenderOptions {
  lang: Lang;
  now: Date;
  /** The reader's own unsubscribe link, shown in the footer. */
  unsubscribeUrl: string;
  /** Builds the link a story title points at. */
  storyUrl: (id: string) => string;
  /** The site's address, for the footer link. */
  siteUrl: string;
}

interface Rendered {
  subject: string;
  html: string;
  text: string;
}

function storyHtml(item: NewsItem, o: RenderOptions, copy: DigestCopy): string {
  const text = storyText(item, o.lang);
  const summary = truncate(text.summary, 220);
  const outlets = item.coverageCount > 1 ? ` · ${copy.coverage(item.coverageCount)}` : "";
  const topic = topicLabel(item.topic, o.lang);

  return `<div style="margin:0 0 20px;padding:0 0 20px;border-bottom:1px solid #d3d5d7;">
      <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:#d60b19;font-weight:600;">${escapeHtml(topic)}</p>
      <a href="${escapeHtml(o.storyUrl(item.id))}" lang="${langAttr(text.lang)}" style="font-size:17px;line-height:1.4;font-weight:600;color:#192746;text-decoration:none;">${escapeHtml(text.title)}</a>${
        summary
          ? `\n      <p lang="${langAttr(text.lang)}" style="margin:6px 0 0;font-size:14px;line-height:1.6;color:#51565a;">${escapeHtml(summary)}</p>`
          : ""
      }
      <p style="margin:6px 0 0;font-size:12px;color:#51565a;">${escapeHtml(item.sourceName)}${escapeHtml(outlets)}</p>
    </div>`;
}

function sectionHtml(
  title: string,
  items: NewsItem[],
  o: RenderOptions,
  copy: DigestCopy,
): string {
  if (items.length === 0) return "";
  return `<h2 style="margin:28px 0 16px;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#51565a;font-weight:700;">${escapeHtml(title)}</h2>
    ${items.map((item) => storyHtml(item, o, copy)).join("\n    ")}`;
}

/** The email for one reader, in their language. */
export function renderDigest(stories: DigestStories, o: RenderOptions): Rendered {
  const copy = COPY[o.lang];
  const date = displayDate(o.now, o.lang);
  const subject = copy.subject(date);

  // The head is small but not optional. `charset` is what keeps Devanagari from
  // arriving as mojibake in a client that guesses; `viewport` is what makes a
  // mobile client scale the 600px card instead of shrinking it; `color-scheme`
  // tells clients the palette below is fixed, so they do not invert it into a
  // dark mode the contrast figures were never checked against; and the title is
  // what assistive tech and some clients announce the message by.
  const html = `<!doctype html>
<html lang="${o.lang === "np" ? "ne" : "en"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(subject)}</title></head><body style="margin:0;padding:32px 16px;background:#e6ebf6;font-family:${FONT};color:#192746;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #d3d5d7;border-radius:6px;padding:32px;">
    <p style="margin:0 0 4px;font-size:20px;font-weight:700;letter-spacing:-0.02em;">${escapeHtml(copy.brand)} <span style="color:#d60b19;">${o.lang === "np" ? "EkJhalak" : "एक झलक"}</span></p>
    <p style="margin:0 0 4px;font-size:13px;color:#51565a;">${escapeHtml(date)}</p>
    <h1 style="margin:16px 0 0;font-size:22px;line-height:1.3;font-weight:600;">${escapeHtml(copy.heading)}</h1>
    ${sectionHtml(copy.national, stories.national, o, copy)}
    ${sectionHtml(copy.international, stories.international, o, copy)}
    <p style="margin:8px 0 0;"><a href="${escapeHtml(o.siteUrl)}" style="font-size:14px;font-weight:600;color:#d60b19;text-decoration:none;">${escapeHtml(copy.openSite)}</a></p>
    <p style="margin:28px 0 0;font-size:12px;line-height:1.6;color:#51565a;">${escapeHtml(copy.reason)} <a href="${escapeHtml(o.unsubscribeUrl)}" style="color:#51565a;">${escapeHtml(copy.unsubscribe)}</a></p>
  </div>
</body></html>`;

  const lines: string[] = [`${copy.brand} — ${date}`, "", copy.heading];
  const section = (title: string, items: NewsItem[]) => {
    if (items.length === 0) return;
    lines.push("", title.toUpperCase(), "");
    for (const item of items) {
      const text = storyText(item, o.lang);
      lines.push(text.title, o.storyUrl(item.id), "");
    }
  };
  section(copy.national, stories.national);
  section(copy.international, stories.international);
  lines.push(copy.reason, `${copy.unsubscribe}: ${o.unsubscribeUrl}`);

  return { subject, html, text: lines.join("\n") };
}

/**
 * The headers that put an unsubscribe button in the mail client itself.
 *
 * `List-Unsubscribe-Post` is RFC 8058 one-click: the client POSTs to the URL
 * with no page in between. Gmail and Yahoo expect it from bulk senders, and a
 * message that carries it is a message a reader can leave without opening it —
 * which is better for them than marking it as spam.
 */
export function unsubscribeHeaders(oneClickUrl: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${oneClickUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

/** The language a stored subscriber preference means. */
export function subscriberLang(value: string): OriginalLang {
  return value === "np" ? "np" : "en";
}
