// lib/html-entities.ts
// One HTML entity decoder, used by the feed parser, the article extractor and
// the display sanitizer.
//
// It exists because the three of them each had their own, and all three ended
// with the same two lines:
//
//     .replace(/&#\d+;/g, " ")
//     .replace(/&[a-z]+;/gi, " ")
//
// — which deletes every entity they did not name individually. For Latin text
// that quietly loses a few dashes and quotes. For Devanagari it is total: some
// Nepali newsrooms serve their pages entity-encoded, so a headline arrives as
// `&#2342;&#2369;&#2352;&#2381;&#2327;&#2366;` and those two lines turn it into
// six spaces. Setopati's og:description is exactly that, 2,279 characters of it.
//
// Decoding numerically covers every code point without a lookup table; the named
// map below only has to carry the handful of names that are not numeric.

const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ensp: " ",
  emsp: " ",
  thinsp: " ",
  shy: "",
  // Invisible joiners. These are not decoration in Devanagari — a zero-width
  // joiner is what holds a conjunct together, so Nepali CMSes emit `&zwj;`
  // inside ordinary words: `पद्&zwj;मा`, `नपुर्&zwj;याए`. Left unmapped they
  // survive the decoder (unknown names are deliberately preserved, so `AT&T`
  // works) and print literally in the middle of a headline.
  zwj: "‍",
  zwnj: "‌",
  lrm: "‎",
  rlm: "‏",
  wj: "⁠",
  ndash: "-",
  mdash: " - ",
  hellip: "…",
  lsquo: "'",
  rsquo: "'",
  sbquo: "'",
  ldquo: '"',
  rdquo: '"',
  bdquo: '"',
  laquo: "«",
  raquo: "»",
  bull: "•",
  middot: "·",
  deg: "°",
  copy: "©",
  reg: "®",
  trade: "™",
  euro: "€",
  pound: "£",
  yen: "¥",
  cent: "¢",
  sect: "§",
  para: "¶",
  dagger: "†",
  permil: "‰",
  prime: "′",
  Prime: "″",
  times: "×",
  divide: "÷",
  minus: "−",
  plusmn: "±",
  frac12: "½",
  frac14: "¼",
  frac34: "¾",
  hearts: "♥",
  rarr: "→",
  larr: "←",
  harr: "↔",
  eacute: "é",
  egrave: "è",
  agrave: "à",
  ccedil: "ç",
  uuml: "ü",
  ouml: "ö",
  auml: "ä",
  szlig: "ß",
  ntilde: "ñ",
  aacute: "á",
  iacute: "í",
  oacute: "ó",
  uacute: "ú",
};

/**
 * `<`, `>` and `&` decode to themselves, like every other entity.
 *
 * That is safe here for two reasons, and only for those reasons. `htmlToText`
 * strips tags *before* it decodes, so a decoded angle bracket arrives after the
 * parser has finished and cannot become a tag. And every consumer of this output
 * hands it to React as a text child, which escapes on render — nothing in this
 * codebase writes it to innerHTML. Blanking them instead would also be
 * inconsistent, since `&lt;` and `&#60;` are the same character written two ways
 * and must not decode differently.
 *
 * Only things that are not text are rejected: lone surrogates, which are not
 * characters, and the C0 controls, which render as nothing or as a box.
 */
function fromCodePoint(code: number): string {
  if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return " ";
  if (code >= 0xd800 && code <= 0xdfff) return " ";
  if (code < 0x20 && code !== 0x09 && code !== 0x0a) return " ";
  try {
    return String.fromCodePoint(code);
  } catch {
    return " ";
  }
}

/**
 * Decode HTML entities, numeric ones included.
 *
 * Runs twice, because several feeds double-encode: the publisher escapes the
 * body once on the way into their CMS and the RSS serializer escapes it again,
 * so `&amp;#2342;` arrives and one pass leaves `&#2342;` sitting in the output.
 * Two passes settle every case seen in this feed set; a third has never changed
 * anything, and looping to a fixed point would let a crafted input spin.
 */
export function decodeEntities(input: string): string {
  if (!input || !input.includes("&")) return input;

  let out = input;
  for (let pass = 0; pass < 2; pass++) {
    if (!out.includes("&")) break;
    out = out.replace(
      /&(?:#([0-9]{1,7})|#[xX]([0-9a-fA-F]{1,6})|([a-zA-Z][a-zA-Z0-9]{1,31}));/g,
      (match, dec: string | undefined, hex: string | undefined, name: string | undefined) => {
        if (dec !== undefined) return fromCodePoint(Number.parseInt(dec, 10));
        if (hex !== undefined) return fromCodePoint(Number.parseInt(hex, 16));
        if (name !== undefined) {
          const mapped = NAMED[name] ?? NAMED[name.toLowerCase()];
          // An unknown name is left alone rather than blanked: `AT&T` and
          // `Q&A` appear unescaped in real headlines, and `&T;`/`&A;` are not
          // entities. Deleting them produced "AT" and "Q".
          return mapped ?? match;
        }
        return match;
      },
    );
  }
  return out;
}

/** Strip tags and decode entities — the order matters, tags first. */
export function htmlToText(html: string): string {
  if (!html) return "";
  return decodeEntities(
    html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<\/(?:p|div|li|h[1-6])>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}
