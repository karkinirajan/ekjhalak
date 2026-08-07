// lib/text-audit.ts
// The mechanical half of "is this good enough to publish".
//
// A model can be asked whether a summary is accurate. It cannot be trusted to
// notice that its own output is half Devanagari, ends mid-word, or begins with
// "Here is the summary:" — those are failures of the machinery around it, and a
// model asked to grade them will sometimes cheerfully report that everything is
// fine. Worse, each such question costs a request from a metered daily quota.
//
// So the checks that can be decided by looking at the characters are decided by
// looking at the characters. They are free, instant, deterministic, and they run
// on every string before any model is asked anything. What is left for the model
// is the one question code genuinely cannot answer: does this text say what the
// source said.
//
// Nothing here is advisory. A `fatal` finding means the text does not go in
// front of a reader in that language.

export type AuditSeverity = "fatal" | "warn";

export interface AuditFinding {
  code: AuditCode;
  severity: AuditSeverity;
  /** Human-readable, for logs and the admin surface. Not shown to readers. */
  detail: string;
}

export type AuditCode =
  | "empty"
  | "too-short"
  | "script-mixed"
  | "wrong-script"
  | "encoding-artifact"
  | "markup-leak"
  | "entity-leak"
  | "model-preamble"
  | "model-refusal"
  | "truncated"
  | "repetition"
  | "headline-echo";

export interface AuditResult {
  ok: boolean;
  findings: AuditFinding[];
}

export type TextLang = "en" | "np";

/** Below this a summary is a fragment, whatever else is true of it. */
const MIN_CHARS = 60;

/**
 * How much of the *other* script a passage may contain before it is wrong.
 *
 * Not zero, in either direction, and the asymmetry is deliberate.
 *
 * Nepali prose legitimately carries Latin: acronyms the language has not
 * translated (NRB, IPO, SEE), brand and place names, and Arabic numerals, which
 * Nepali newsrooms use far more than Devanagari digits. A hard zero would fail
 * most real Nepali sentences. 35% is comfortably above ordinary borrowing and
 * well below "this is an English sentence with a Nepali word in it".
 *
 * English prose carries essentially no Devanagari. A stray श्री or a half-copied
 * headline is a real defect, so the tolerance is 2% — enough to survive a single
 * transliterated name, not enough to survive a sentence.
 */
const MAX_FOREIGN_LATIN_IN_NP = 0.35;
const MAX_DEVANAGARI_IN_EN = 0.02;

const DEVANAGARI = /[ऀ-ॿ]/g;
const LATIN_LETTER = /[A-Za-z]/g;

/**
 * Text a model produced about the task instead of doing it.
 *
 * These leak into output regularly enough to be worth naming individually, and
 * every one of them renders to a reader as a story that begins by talking about
 * itself. Anchored at the start because "here is the thing" mid-paragraph is
 * ordinary prose.
 */
const PREAMBLE =
  /^\s*(?:here(?:'s| is| are)\b|sure[,!.]|okay[,!.]|certainly[,!.]|below is\b|the following\b|summary\s*:|translation\s*:|translated text\s*:|output\s*:|\*\*summary\*\*|यहाँ छ\b|सारांश\s*:|अनुवाद\s*:)/i;

/** A model declining, apologising, or narrating its own limits. */
const REFUSAL =
  /\b(?:i(?:'m| am) (?:sorry|unable|an ai)|as an ai\b|i cannot\b|i can(?:'|no)t (?:provide|translate|summar)|unable to (?:provide|process|translate)|no content (?:was )?provided|insufficient (?:context|information) to)/i;

/** Mojibake and replacement characters — a decoding step that went wrong. */
const ENCODING_ARTIFACT =
  /�|[Â-Ã][-¿]|â€[“”]|Ã[ -¿]/;

const MARKUP = /<\s*\/?\s*[a-zA-Z][^>]{0,200}>/;
const ENTITY = /&(?:[a-zA-Z]{2,8}|#\d{1,7}|#x[0-9a-fA-F]{1,6});/;

/**
 * Ends without finishing.
 *
 * Terminal punctuation in either script, an ellipsis, or a closing quote or
 * bracket after one. Anything else means the text stopped rather than ended —
 * usually a token limit, occasionally a truncation upstream.
 */
const ENDS_CLEANLY = /[.!?।…]["'”’)\]]?\s*$/;

/**
 * Words no sentence ends on.
 *
 * A summary cut at a token limit very often lands on one of these, and the
 * result reads as a dropped thought even when the punctuation happens to look
 * right. Both scripts, because both fail the same way.
 */
const DANGLING_TAIL =
  /\b(?:and|or|but|the|a|an|of|to|in|on|at|for|with|from|by|as|that|which|who|while|after|before|because|however)\s*[.…]?\s*$|(?:र|तर|वा|को|का|की|मा|ले|लाई|बाट|सँग|तथा|अनि|जुन|जसले|भन्ने|पछि|अघि)\s*[।…]?\s*$/i;

function ratio(text: string, pattern: RegExp): number {
  const letters = text.replace(/[^\p{L}]/gu, "").length;
  if (letters === 0) return 0;
  return (text.match(pattern) ?? []).length / letters;
}

/**
 * Is any sentence repeated verbatim?
 *
 * Model degeneration usually shows up as a clause looping rather than a whole
 * paragraph, so this compares normalised sentences and needs only one exact
 * repeat to fire. Short fragments are skipped — "He said." twice is prose, not
 * a loop.
 */
function hasRepetition(text: string): string | null {
  const sentences = text
    .split(/(?<=[.!?।])\s+/)
    .map((s) => s.trim().toLowerCase().replace(/\s+/g, " "))
    .filter((s) => s.length >= 40);

  const seen = new Set<string>();
  for (const sentence of sentences) {
    if (seen.has(sentence)) return sentence.slice(0, 60);
    seen.add(sentence);
  }
  return null;
}

/** Normalised for comparison — case, whitespace and terminal punctuation. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.!?।…\s]+$/, "")
    .trim();
}

export interface AuditOptions {
  /** The script this passage is supposed to be written in. */
  lang: TextLang;
  /** The story's headline, to catch a summary that only restates it. */
  title?: string;
  /** Minimum acceptable length. Titles are held to a lower bar than bodies. */
  minChars?: number;
  /**
   * Whether the passage must end on terminal punctuation.
   *
   * True for prose and false for headlines, because a headline that ends on a
   * full stop is the unusual one — "Nepal Rastra Bank raises the policy rate"
   * is complete and correctly punctuated by ending on nothing at all. Applying
   * the prose rule to titles failed every well-formed headline in the corpus,
   * which is how this option came to exist.
   *
   * The dangling-word check still runs either way: "Nepal Rastra Bank raises
   * the" is broken as a headline too, and that is what catches it.
   */
  requireTerminalPunctuation?: boolean;
}

/**
 * Everything mechanically wrong with one passage.
 *
 * Returns all findings rather than the first, because "this text has four
 * problems" is a more useful signal than "this text has a problem" when
 * deciding whether a model is misbehaving or a source is.
 */
export function auditText(text: string, options: AuditOptions): AuditResult {
  const findings: AuditFinding[] = [];
  const add = (code: AuditCode, severity: AuditSeverity, detail: string) =>
    findings.push({ code, severity, detail });

  const trimmed = (text ?? "").trim();

  if (!trimmed) {
    return { ok: false, findings: [{ code: "empty", severity: "fatal", detail: "no text" }] };
  }

  const minChars = options.minChars ?? MIN_CHARS;
  if (trimmed.length < minChars) {
    add("too-short", "fatal", `${trimmed.length} chars, need ${minChars}`);
  }

  // ── Script ────────────────────────────────────────────────────────────────
  const devanagari = ratio(trimmed, DEVANAGARI);
  const latin = ratio(trimmed, LATIN_LETTER);

  if (options.lang === "en") {
    if (devanagari > MAX_DEVANAGARI_IN_EN) {
      add(
        devanagari > 0.5 ? "wrong-script" : "script-mixed",
        "fatal",
        `${(devanagari * 100).toFixed(1)}% Devanagari in English text`,
      );
    }
  } else {
    if (latin > MAX_FOREIGN_LATIN_IN_NP) {
      add(
        latin > 0.7 ? "wrong-script" : "script-mixed",
        "fatal",
        `${(latin * 100).toFixed(1)}% Latin in Nepali text`,
      );
    }
    // Nepali text with no Devanagari at all is not Nepali, however few Latin
    // letters it has — a romanised or untranslated passage lands here.
    if (devanagari === 0) {
      add("wrong-script", "fatal", "no Devanagari in text marked Nepali");
    }
  }

  // ── Mechanical damage ─────────────────────────────────────────────────────
  if (ENCODING_ARTIFACT.test(trimmed)) {
    add("encoding-artifact", "fatal", "replacement character or mojibake");
  }
  if (MARKUP.test(trimmed)) {
    add("markup-leak", "fatal", "HTML tag in reader-facing text");
  }
  if (ENTITY.test(trimmed)) {
    add("entity-leak", "fatal", "undecoded HTML entity");
  }

  // ── The model talking about itself ────────────────────────────────────────
  if (PREAMBLE.test(trimmed)) {
    add("model-preamble", "fatal", `starts with "${trimmed.slice(0, 30)}…"`);
  }
  if (REFUSAL.test(trimmed)) {
    add("model-refusal", "fatal", "model declined or apologised instead of answering");
  }

  // ── Completeness ──────────────────────────────────────────────────────────
  const needsPunctuation = options.requireTerminalPunctuation ?? true;
  if (needsPunctuation && !ENDS_CLEANLY.test(trimmed)) {
    add("truncated", "fatal", `ends "…${trimmed.slice(-24)}"`);
  } else if (DANGLING_TAIL.test(trimmed)) {
    add("truncated", "fatal", `ends on a dangling word: "…${trimmed.slice(-24)}"`);
  }

  const repeated = hasRepetition(trimmed);
  if (repeated) {
    add("repetition", "warn", `sentence repeats: "${repeated}…"`);
  }

  // ── Says nothing the headline did not ─────────────────────────────────────
  if (options.title) {
    const body = normalize(trimmed);
    const head = normalize(options.title);
    if (head && (body === head || (body.length < head.length * 1.3 && body.startsWith(head)))) {
      add("headline-echo", "fatal", "summary restates the headline and adds nothing");
    }
  }

  return { ok: !findings.some((f) => f.severity === "fatal"), findings };
}

/**
 * Audit a whole story in one language.
 *
 * Titles get a lower length floor — a headline is allowed to be six words — and
 * are not checked for echo against themselves.
 */
export function auditStoryText(
  parts: { title: string; summary: string },
  lang: TextLang,
): AuditResult {
  const title = auditText(parts.title, {
    lang,
    minChars: 10,
    requireTerminalPunctuation: false,
  });
  const summary = auditText(parts.summary, { lang, title: parts.title });

  const findings = [
    ...title.findings.map((f) => ({ ...f, detail: `title: ${f.detail}` })),
    ...summary.findings.map((f) => ({ ...f, detail: `summary: ${f.detail}` })),
  ];

  return { ok: !findings.some((f) => f.severity === "fatal"), findings };
}

/** Compact one-line form for logs. */
export function formatFindings(result: AuditResult): string {
  if (result.findings.length === 0) return "clean";
  return result.findings
    .map((f) => `${f.severity === "fatal" ? "!" : "?"}${f.code}(${f.detail})`)
    .join(" ");
}
