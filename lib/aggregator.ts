// lib/aggregator.ts
// Parallel RSS ingestion across all active sources.
// Output is cached with Next.js unstable_cache (5-minute revalidation).
// Server-only.

// Build-time guard: importing this from a client component is a build
// error rather than a shipped bundle. Reads GEMINI_API_KEY and SUPABASE_SERVICE_ROLE_KEY through its callees.
import "server-only";

import { unstable_cache } from "next/cache";
import { ACTIVE_SOURCES } from "./source-registry";
import { fetchRssFeed } from "./rss-adapter";
import { normalizeStory } from "./feed-normalizer";
import { deduplicate } from "./deduplicator";
import { decodeEntities, htmlToText } from "./html-entities";
import {
  auditStoryText,
  auditText,
  formatFindings,
  type AuditResult,
  type TextLang,
} from "./text-audit";
import { scoreStory } from "./ranking";
import { extractMany, type ExtractionResult } from "./article-extractor";
import {
  enrichStories,
  verifyEnrichments,
  isEnrichmentConfigured,
  looksLikeBoilerplate,
  hardTruncateSummary,
  SUMMARY_MIN_CHARS,
  VERBATIM_MAX_CHARS,
  type EnrichInput,
  type EnrichResult,
} from "./summarizer";
import {
  enrichmentKey,
  readEnrichment,
  writeEnrichment,
} from "./enrichment-cache";
import {
  recordArticles,
  fetchEnrichments,
  noteHydrate,
  isStoreConfigured,
} from "./article-store";
import { applyPublishGate } from "./publish-gate";
import type { NewsItem, SourceStatusMeta } from "./news-pipeline";
import type { Source } from "./source-registry";

export interface AggregatedFeed {
  items: NewsItem[];
  sourceStatuses: SourceStatusMeta[];
  fetchedAt: number;
}

interface SourceResult {
  source: Source;
  items: NewsItem[];
  status: SourceStatusMeta;
}

async function fetchOneSource(
  source: Source,
  deadline: number,
): Promise<SourceResult> {
  const start = Date.now();

  if (!source.rssUrl) {
    return {
      source,
      items: [],
      status: {
        id: source.id,
        name: source.name,
        ok: false,
        itemCount: 0,
        fetchedAt: start,
        error: "No RSS URL configured",
      },
    };
  }

  try {
    const rawStories = await fetchRssFeed(source.rssUrl, deadline);
    const filtered = source.urlPrefix
      ? rawStories.filter((raw) => raw.url.startsWith(source.urlPrefix!))
      : rawStories;
    const items = filtered.map((raw) => normalizeStory(raw, source));
    return {
      source,
      items,
      status: {
        id: source.id,
        name: source.name,
        ok: true,
        itemCount: items.length,
        fetchedAt: start,
      },
    };
  } catch (err) {
    return {
      source,
      items: [],
      status: {
        id: source.id,
        name: source.name,
        ok: false,
        itemCount: 0,
        fetchedAt: start,
        error: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

async function aggregateAllSources(): Promise<AggregatedFeed> {
  const fetchedAt = Date.now();
  // One clock for the whole pass. Both enrichment stages read what is left of
  // it rather than starting their own, so RSS running slow shortens enrichment
  // instead of delaying the response past the point where Netlify gives up.
  const deadline = fetchedAt + AGGREGATE_BUDGET_MS;

  const sourcesToFetch = [...ACTIVE_SOURCES].sort(
    (a, b) => b.priority - a.priority,
  );

  const rssDeadline = Date.now() + slice(deadline, AGGREGATE_BUDGET_MS, RSS_SHARE);
  const results = await Promise.allSettled(
    sourcesToFetch.map((source) => fetchOneSource(source, rssDeadline)),
  );

  const allItems: NewsItem[] = [];
  const sourceStatuses: SourceStatusMeta[] = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      allItems.push(...result.value.items);
      sourceStatuses.push(result.value.status);
    }
  }

  allItems.sort((a, b) => b.publishedTimestamp - a.publishedTimestamp);
  const deduped = deduplicate(allItems);

  const rssMs = Date.now() - fetchedAt;

  // Enrichment stops early enough to leave the archive its slice. Taken out of
  // the model stage rather than added on the end, so AGGREGATE_BUDGET_MS stays
  // the ceiling on the whole pass and not a number the pass exceeds by design —
  // and only reserved when there is somewhere to write, so a deployment without
  // a database spends every millisecond on the feed.
  const storeReserve = isStoreConfigured() ? STORE_RESERVE_MS : 0;
  const items = await enrichFeed(deduped, fetchedAt, deadline - storeReserve);
  annotateDescriptionCoverage(sourceStatuses, items);

  // Awaited, despite nothing depending on the result. A genuinely un-awaited
  // promise is not fire-and-forget on a serverless platform, it is fire-and-
  // maybe: the function can be frozen the moment the response is sent, and the
  // write would land or not depending on how quickly the reader's request
  // finished. Bounded at STORE_RESERVE_MS and swallowing its own failures, so
  // waiting for it cannot cost the reader more than its slice or fail the feed.
  await recordArticles(items, deadline);

  // Reported per stage, not as one number. "The pass took 40s" is not
  // actionable — every stage has its own timeout and its own remedy, and the
  // one that overran is the only one worth touching.
  const elapsed = Date.now() - fetchedAt;
  if (elapsed > AGGREGATE_BUDGET_MS + BUDGET_GRACE_MS) {
    console.warn(
      `[aggregator] pass took ${elapsed}ms, over the ${AGGREGATE_BUDGET_MS}ms budget ` +
        `(rss ${rssMs}ms, enrich ${elapsed - rssMs}ms)`,
    );
  }

  return { items, sourceStatuses, fetchedAt };
}

/**
 * Record what share of each outlet's surviving stories carry body text.
 *
 * A source that reaches zero here ships headlines and nothing else, and every
 * one of its stories has just been dropped — which would otherwise look like the
 * outlet going quiet rather than a feed that needs replacing. Reported per
 * source so it is visible in /api/news rather than inferred from an absence.
 */
function annotateDescriptionCoverage(
  statuses: SourceStatusMeta[],
  survivors: NewsItem[],
): void {
  const kept = new Map<string, number>();
  for (const item of survivors) {
    kept.set(item.sourceId, (kept.get(item.sourceId) ?? 0) + 1);
  }

  for (const status of statuses) {
    if (!status.ok) continue;
    const withText = kept.get(status.id) ?? 0;
    status.itemsWithText = withText;
    if (status.itemCount > 0 && withText === 0) {
      status.error = "No story in this feed carried body text";
      console.warn(
        `[aggregator] ${status.name}: 0/${status.itemCount} stories had body text — all dropped`,
      );
    }
  }
}

/**
 * The ceiling on one whole regeneration, enrichment included.
 *
 * This is the number that keeps the feed endpoint answering. `getCachedFeed`
 * revalidates every five minutes, and Next.js resolves that on the request path:
 * whichever reader arrives first after the entry goes stale pays for the entire
 * pass while everyone behind them waits. Netlify gives up on a request at 30
 * seconds and returns a 502, so a pass that overruns does not merely feel slow —
 * it hands one reader every five minutes a broken page.
 *
 * The two stage budgets below used to be independent and additive: 15 seconds of
 * page extraction plus 25 seconds at the model is 40 seconds before a single RSS
 * byte is fetched. Nothing bounded the sum, and nothing had to — while
 * GEMINI_MODEL was pinned to an exhausted model every call 429'd instantly and
 * the model stage returned in milliseconds. Unpinning it made the fallback chain
 * work, the stage started spending what it was given, and the pass crossed the
 * limit for the first time.
 *
 * So the stage budgets are now caps *within* this deadline rather than
 * allowances added to it, and every network call inside them clamps its own
 * timeout to what is left — a batch claimed with two seconds on the clock does
 * not get the full 45-second request timeout.
 *
 * 15 seconds against a 30-second platform limit is deliberately conservative.
 * The pass reliably spends its whole budget, so this number *is* the cold-start
 * latency a reader sees, and the margin above it is what absorbs a slow cold
 * start underneath. Spending less time enriching costs coverage, not
 * correctness: whatever this pass does not reach keeps the publisher's own text
 * and is picked up by the next one.
 */
const AGGREGATE_BUDGET_MS = Number.parseInt(
  process.env.AGGREGATE_BUDGET_MS ?? "15000",
  10,
);

/**
 * How far past the budget the pass may land before it is worth logging.
 *
 * The pass is *expected* to reach its budget — that is what a deadline is for —
 * so warning at the budget itself would fire on every healthy cold start and
 * teach whoever reads these logs to ignore them.
 */
const BUDGET_GRACE_MS = 2_000;

/**
 * The tail of the pass held back for writing to the archive.
 *
 * Only claimed when a database is configured. Three seconds is generous for one
 * upsert of a few hundred rows and small enough that the model stage, which is
 * what it comes out of, loses at most a batch — and a batch the model does not
 * reach this pass is enriched by the next one, whereas a row not written is a
 * day of history that never existed.
 */
const STORE_RESERVE_MS = 3_000;

/**
 * The ceiling on asking the archive what it already knows.
 *
 * A cap *within* the model stage, not an allowance added to it: whatever this
 * spends, the model does not get. That trade is lopsided in its favour and the
 * arithmetic says so. One read of a few hundred ids costs a few hundred
 * milliseconds and can return hundreds of finished translations; the same
 * stories cost the model a metered request each, out of a measured allowance of
 * 1,060 a day. On a day when that allowance is already spent — which is most
 * days, and was every day before this existed — the archive is not the cheaper
 * source of translations, it is the only one.
 */
const HYDRATE_BUDGET_MS = 3_000;

/**
 * The ceiling on the verification pass.
 *
 * A cap within AGGREGATE_BUDGET_MS like every other stage, and the last in the
 * queue, so on a slow pass it gets nothing and stories stay unverified rather
 * than the pass overrunning. That ordering is deliberate: an unverified story
 * still reads correctly, whereas a pass that crosses Netlify's 30-second limit
 * returns 502 to a reader. Quality is worth budget; it is not worth the site.
 */
const VERIFY_BUDGET_MS = Number.parseInt(
  process.env.VERIFY_BUDGET_MS ?? "8000",
  10,
);

/**
 * The share of the pass that RSS ingestion may take.
 *
 * Every source is fetched at once and awaited together, so the stage costs
 * whatever the *slowest single* source costs — one outlet that answers its
 * headers promptly and then dribbles the body sets the price for all two dozen.
 * Half the pass is generous for what is, per source, one small XML document; the
 * bound exists so that when a source misbehaves the cost lands on it rather than
 * on the stages downstream, which are the ones that make the feed readable.
 *
 * A source that does not answer in time is simply absent from this pass. Its
 * stories are still in the next one, and the feed already renders whatever
 * arrived — `Promise.allSettled`, not `Promise.all`.
 */
const RSS_SHARE = 0.5;

/**
 * The share of whatever time is left after RSS that page extraction may take.
 *
 * Extraction feeds the model — text pulled off the article page is what the
 * summariser works from — so starving it makes the model stage worse, not
 * faster. But it is spent on two dozen other people's web servers and is the
 * more likely of the two to stall, so it gets the smaller half.
 */
const EXTRACT_SHARE = 0.4;

/**
 * How long one regeneration may spend at the model.
 *
 * A cap, not an allowance: the pass takes the lesser of this and whatever
 * remains of AGGREGATE_BUDGET_MS after RSS and extraction have had their turn.
 *
 * Whatever the budget does not reach keeps its cached enrichment or its
 * deterministic fallback, and the next regeneration picks up where this one
 * stopped — so this is a latency control, not a quality one.
 */
const ENRICH_BUDGET_MS = Number.parseInt(
  process.env.GEMINI_BUDGET_MS ?? "25000",
  10,
);

/**
 * Rewrite and translate every story, best stories first.
 *
 * Ordering by newsworthiness is load-bearing. The free-tier quota means a cold
 * feed cannot be fully enriched in one pass, so *which* stories a pass reaches
 * decides what the reader sees — and the reader sees the front page. Sorting
 * candidates by the same score that ranks the grid means the budget is spent on
 * the cards above the fold, and the tail fills in over subsequent passes.
 */
/**
 * Wall-clock for the article-page pass that runs before the model does.
 *
 * A cap, like ENRICH_BUDGET_MS: the pass takes the lesser of this and its share
 * of what remains of AGGREGATE_BUDGET_MS. Whatever it does not reach this time
 * is cached-by-absence nowhere — the next regeneration simply starts again from
 * the same ranked order, so the front page converges first.
 */
const EXTRACT_BUDGET_MS = Number.parseInt(
  process.env.EXTRACT_BUDGET_MS ?? "15000",
  10,
);

/**
 * A stage's slice of the pass, in milliseconds, floored at zero.
 *
 * Returning 0 rather than a negative number matters: both stages take a
 * deadline as an absolute timestamp, and `Date.now() + -4000` is a deadline four
 * seconds in the past, which reads to them as "one item then stop" rather than
 * "skip". Callers check for 0 and skip the stage outright.
 */
function slice(deadline: number, cap: number, share = 1): number {
  const remaining = deadline - Date.now();
  if (remaining <= 0) return 0;
  return Math.max(0, Math.min(cap, Math.floor(remaining * share)));
}

async function enrichFeed(
  items: NewsItem[],
  now: number,
  deadline: number,
): Promise<NewsItem[]> {
  const ranked = [...items].sort(
    (a, b) => scoreStory(b, now) - scoreStory(a, now),
  );

  // ── 1. Ask each article's own page for body text ──────────────────────────
  //
  // Not only for the stories that arrived empty. A feed's <description> is
  // frequently a one-line teaser where the page's own og:description carries the
  // whole story — measured at 2,000–2,300 characters on the Nepali outlets here
  // against feed blurbs of 130–250. Where the page has more to say than the
  // feed, the page wins: it is the same newsroom's text either way, and the
  // longer one is the one they actually wrote.
  const extractMs = slice(deadline, EXTRACT_BUDGET_MS, EXTRACT_SHARE);
  const extractStart = Date.now();
  const extracted = extractMs
    ? await extractMany(
        ranked.map((item) => item.sourceUrl),
        Date.now() + extractMs,
      )
    : new Map<string, ExtractionResult>();
  const extractElapsed = Date.now() - extractStart;
  if (extractElapsed > extractMs + 1000) {
    console.warn(
      `[aggregator] extraction took ${extractElapsed}ms against a ${extractMs}ms slice`,
    );
  }

  for (const item of ranked) {
    const found = extracted.get(item.sourceUrl);
    if (!found) continue;

    // The photograph, where the feed shipped none. Ten of the twenty-two
    // sources carry no media fields in their RSS at all — Kathmandu Post, DW,
    // Al Jazeera and Onlinekhabar among them — which left half the grid on
    // generated cover art while the newsroom's own picture sat in og:image on a
    // page this pass had already fetched. The feed's own image still wins when
    // it has one: it is the publisher's choice for that item specifically.
    if (!item.imageUrl && found.imageUrl) item.imageUrl = found.imageUrl;

    if (!found.text || looksLikeBoilerplate(found.text)) continue;
    if (found.text.length > item.summary.length) item.summary = found.text;
  }

  // ── 2. Decide what still needs the model ──────────────────────────────────
  let pending: Array<{ item: NewsItem; key: string; input: EnrichInput }> = [];
  const enriched = new Set<string>();

  /**
   * Mark a story as carrying this pass's enrichment.
   *
   * Stamping `enrichmentKey` is what gives `recordArticles` permission to write
   * the four enrichment columns for this story, so it happens **only where
   * enrichment actually landed** — an L1 hit, an archive hit, or a model reply —
   * and never merely where one was attempted.
   *
   * The distinction is not fussiness. A story still awaiting the model has no
   * translation on it; if it were stamped and the archive read had timed out,
   * the writer would send `title_translated: null` and erase a translation an
   * earlier pass paid a metered request for. Attempted is not the same as
   * answered, and only answered may overwrite.
   */
  const markEnriched = (item: NewsItem, key: string): void => {
    item.enrichmentKey = key;
    enriched.add(item.id);
  };

  for (const item of ranked) {
    // Nothing to work from, from the feed or from the page. The headline is the
    // whole story here, and asking a model to expand a headline is asking it to
    // invent — so this one is dropped at the end rather than filled in.
    if (!item.summary || looksLikeBoilerplate(item.summary)) {
      item.summary = "";
      continue;
    }

    // The publisher's own text, at a length a reader can take: keep it exactly
    // as written. A model rewrite of prose that is already the right size can
    // only lose a fact, and it would spend a request from a metered daily quota
    // to do it. The model is still asked for the translation.
    const verbatim =
      item.summary.length >= SUMMARY_MIN_CHARS &&
      item.summary.length <= VERBATIM_MAX_CHARS;

    const key = enrichmentKey(item.id, item.summary);
    const cached = readEnrichment(key);
    if (cached) {
      applyEnrichment(item, cached);
      markEnriched(item, key);
      continue;
    }

    pending.push({
      item,
      key,
      input: {
        id: item.id,
        title: item.title,
        body: item.summary,
        lang: item.originalLang,
        verbatim,
      },
    });
  }

  // ── 2b. Ask the archive before asking the model ───────────────────────────
  //
  // The stage that makes a bilingual site arithmetically possible.
  //
  // lib/enrichment-cache.ts is an in-process Map, so on Netlify it is empty at
  // the start of every cold invocation. The feed regenerates 288 times a day and
  // each cold pass re-translated stories that were already translated, which is
  // how a measured allowance of 1,060 model requests — comfortably more than the
  // ~1,500 new stories a day need, once batched — produced exactly zero
  // translations in production. The allowance was never insufficient. It was
  // being spent entirely on work already done.
  //
  // The archive is the memory that process lacks, so it becomes the L2 behind
  // that Map's L1 and the two share one key format deliberately. A row only
  // counts when its stored `enrichment_key` equals the freshly computed one,
  // which means the story *and the exact text it was translated from* are
  // unchanged; a publisher who quietly rewrites a body under the same URL — as
  // several here do within the first hour of a breaking story — produces a
  // different key and gets a fresh translation rather than a stale one served
  // forever.
  if (pending.length > 0 && isStoreConfigured()) {
    const hydrateMs = Math.min(HYDRATE_BUDGET_MS, deadline - Date.now());
    if (hydrateMs > 0) {
      const stored = await fetchEnrichments(
        pending.map((entry) => entry.item.id),
        Date.now() + hydrateMs,
      );

      const stillPending: typeof pending = [];
      let hits = 0;

      for (const entry of pending) {
        const row = stored.get(entry.item.id);
        if (!row || row.enrichmentKey !== entry.key) {
          stillPending.push(entry);
          continue;
        }

        // Re-audited on the way in rather than trusted. `applyEnrichment` runs
        // the same deterministic checks it runs on fresh model output, which
        // costs nothing and means a row written by an older, weaker audit is
        // re-examined instead of grandfathered past the gate.
        const result: EnrichResult = {
          summary: row.summary,
          titleTranslated: row.titleTranslated ?? "",
          summaryTranslated: row.summaryTranslated ?? "",
        };
        applyEnrichment(entry.item, result);

        // The one verdict that cannot be recomputed for free. `audited` and
        // `bilingual` are functions of text we now hold, so they were just
        // recalculated; `verified` cost a model request when it was earned and
        // would cost another to re-earn. Carried across only when the audit it
        // was granted under still passes — `applyEnrichment` sets `quality`
        // exactly when it does.
        if (entry.item.quality && row.quality?.verified !== undefined) {
          entry.item.quality.verified = row.quality.verified;
          entry.item.quality.note = row.quality.note;
        }

        // Promote into the L1 too, so the rest of this instance's lifetime is
        // served from memory rather than from another round trip.
        writeEnrichment(entry.key, result);
        markEnriched(entry.item, entry.key);
        hits++;
      }

      noteHydrate(hits, stillPending.length);
      pending = stillPending;

      if (hits > 0) {
        console.info(
          `[archive] restored ${hits} enrichment(s); ${stillPending.length} still need the model`,
        );
      }
    }
  }

  // ── 3. Summarize and translate what is left ───────────────────────────────
  //
  // Takes whatever the pass has left after extraction rather than a fixed
  // allowance, so a slow extraction stage costs the model its time instead of
  // pushing the whole regeneration past the platform's request limit.
  const enrichMs = slice(deadline, ENRICH_BUDGET_MS);
  if (pending.length > 0 && enrichMs > 0 && isEnrichmentConfigured()) {
    try {
      const results = await enrichStories(
        pending.map((entry) => entry.input),
        Date.now() + enrichMs,
      );

      for (const entry of pending) {
        const result = results.get(entry.item.id);
        if (!result) continue;
        writeEnrichment(entry.key, result);
        applyEnrichment(entry.item, result);
        markEnriched(entry.item, entry.key);
      }
    } catch (err) {
      console.warn("[aggregator] enrichment pass failed:", err);
    }
  }

  // ── 3b. Ask a model whether the text is faithful ──────────────────────────
  //
  // The last of the five stages, and the only one a model is genuinely needed
  // for. Everything mechanical was settled by lib/text-audit.ts before this ran,
  // so no request is spent grading text that was already visibly broken, and
  // only stories that got a full bilingual pair are candidates.
  //
  // Its budget is carved out of what enrichment left rather than added on. A
  // pass that spent everything writing has nothing left to check with, and that
  // is the correct outcome: an unverified story keeps its translation and is
  // simply marked unverified, which is what `quality.verified === undefined`
  // means. Withholding it instead would empty the feed on a slow day.
  const verifyMs = slice(deadline, VERIFY_BUDGET_MS);
  // Already-verified stories are excluded, not re-checked. A verdict restored
  // from the archive was paid for with a model request on an earlier pass, and
  // re-earning it every five minutes would put this stage in exactly the loop
  // stage 2b just took the translation stage out of.
  const candidates = ranked.filter(
    (item) =>
      item.quality?.bilingual &&
      item.summaryTranslated &&
      item.quality.verified === undefined,
  );

  if (candidates.length > 0 && verifyMs > 0 && isEnrichmentConfigured()) {
    try {
      const verdicts = await verifyEnrichments(
        candidates.map((item) => ({
          id: item.id,
          source: item.summary,
          lang: item.originalLang,
          summary: item.summary,
          titleTranslated: item.titleTranslated ?? "",
          summaryTranslated: item.summaryTranslated ?? "",
        })),
        Date.now() + verifyMs,
      );

      let failed = 0;
      for (const item of candidates) {
        const verdict = verdicts.get(item.id);
        if (!verdict) continue; // not reached this pass — not a failure

        const ok = verdict.summaryFaithful && verdict.translationFaithful;
        item.quality = { ...item.quality!, verified: ok, note: verdict.reason };

        if (!verdict.translationFaithful) {
          // Same rule as the audit: a translation that does not carry the
          // meaning is worse than no translation, because the UI renders it as
          // though it were sound.
          delete item.titleTranslated;
          delete item.summaryTranslated;
          item.quality.bilingual = false;
          failed++;
        }
      }
      if (failed > 0) {
        console.info(
          `[verify] ${verdicts.size} checked, ${failed} translation(s) withdrawn`,
        );
      }
    } catch (err) {
      // A verification pass that throws leaves everything unverified, which is
      // the same state as never having run. It must not cost the feed.
      console.warn("[verify] pass failed:", err);
    }
  }

  // ── 4. Cap whatever the model never reached ───────────────────────────────
  //
  // These keep the publisher's words, just bounded. A story the budget ran out
  // on is still a real story with real body text; it simply has no translation
  // yet, which the UI already handles by showing the original.
  for (const item of ranked) {
    if (enriched.has(item.id)) continue;
    if (!item.summary) continue;
    item.summary = hardTruncateSummary(item.summary, VERBATIM_MAX_CHARS);
  }

  // ── 5. Drop what has nothing to say ───────────────────────────────────────
  //
  // A headline with no body under it is the one card this site should not
  // render: it tells a reader that something happened and refuses to say what.
  // Its feed had no description, its own page had no extractable text, and the
  // model was never given anything to work from — there is no version of this
  // card that informs anyone.
  // Stories the model never reached carry no verdict, and under the default
  // policy that is fine — `audited` asks whether anything *failed*, not whether
  // everything was checked. Marking them here keeps the gate's reasons honest:
  // "not audited" should mean the audit rejected something, not that the story
  // arrived straight from a feed that was already clean.
  for (const item of items) {
    if (!item.quality) {
      item.quality = { audited: true, bilingual: Boolean(item.summaryTranslated) };
    }
  }

  // The publish gate is deliberately *not* applied here.
  //
  // This function's result is what `unstable_cache` stores, and the archive is
  // written from it. Gating at this point would bake one policy into a cache
  // entry that lives five minutes — changing PUBLISH_POLICY would then do
  // nothing until the cache turned over, which is exactly the confusing
  // behaviour it produced when it was written this way. It would also mean the
  // archive only ever recorded what happened to be publishable that minute,
  // when the whole point of an archive is to hold the rest too.
  //
  // So everything with body text is kept and carries its verdict, and the gate
  // runs at the read layer — see `getPublishedFeed`.
  const kept = items.filter((item) => Boolean(item.summary));
  const dropped = items.length - kept.length;
  if (dropped > 0) {
    console.info(
      `[aggregator] dropped ${dropped}/${items.length} stories with no body text`,
    );
  }

  // ── 6. One last decode, wherever the text came from ───────────────────────
  //
  // Text reaches an item by four routes — the feed's own description, the
  // article page, the model, or a cache entry written by an older build — and
  // each was cleaned at its own entry point. That is three places to get right
  // and one, the cache, that can hold text cleaned by rules that have since
  // changed. A live feed still surfaced `&nbsp;` from NDTV after all three
  // entry points were fixed.
  //
  // The display layer already decodes, so a reader never saw it. The API
  // payload did carry it, and that payload is what the archive stores, what a
  // digest would send and what anything reading /api/news receives. Converging
  // here costs a few string operations over a few hundred items and makes the
  // guarantee positional rather than a property of every upstream path.
  for (const item of kept) {
    item.title = cleanModelText(item.title);
    item.summary = cleanModelText(item.summary);
    if (item.titleTranslated) item.titleTranslated = cleanModelText(item.titleTranslated);
    if (item.summaryTranslated) item.summaryTranslated = cleanModelText(item.summaryTranslated);
  }

  return kept;
}

/**
 * The publisher's own headline is never replaced.
 *
 * It is the one string in the item we are most confident is accurate, it is what
 * the reader will see again if they follow the link, and a model rewrite buys
 * nothing the summary underneath it does not already deliver. Only the
 * *translated* headline comes from the model, because there is no other source
 * for one.
 */
/**
 * Model output is not trusted text.
 *
 * The feed parser and the article extractor both clean what they read, but
 * whatever the model returns went straight into the item — and the model is
 * summarising HTML-derived prose, so it echoes what it was shown. A live feed
 * had `&nbsp;` sitting inside an NDTV summary that no publisher had put there.
 *
 * Cleaned here rather than only at render, so the API payload and anything that
 * ever reads it are clean too.
 */
function applyEnrichment(item: NewsItem, result: EnrichResult): void {
  const originalLang = item.originalLang;
  const otherLang: TextLang = originalLang === "np" ? "en" : "np";

  // ── The original language ─────────────────────────────────────────────────
  //
  // A rewrite that fails the audit is discarded rather than shown. The
  // publisher's own text is already sitting in `item.summary`, and it is always
  // the safer of the two: whatever is wrong with it, it is not half Devanagari
  // and it does not start by saying "Here is the summary:".
  const rewritten = cleanModelText(result.summary);
  if (rewritten) {
    const verdict = auditText(rewritten, {
      lang: originalLang,
      title: item.title,
    });
    if (verdict.ok) {
      item.summary = rewritten;
      item.quality = { ...(item.quality ?? { bilingual: false }), audited: true };
    } else {
      rejected(item, `summary/${originalLang}`, verdict);
    }
  }

  // ── The translation ───────────────────────────────────────────────────────
  //
  // Here there is no fallback, and that is the point. A missing translation is
  // handled everywhere in the UI — the reader sees the story in its original
  // language, which is honest. A *broken* translation is rendered as though it
  // were real, and a Nepali reader gets a paragraph of English with three
  // Devanagari words in it. Absent beats wrong.
  const title = cleanModelText(result.titleTranslated ?? "");
  const summary = cleanModelText(result.summaryTranslated ?? "");

  if (title && summary) {
    const verdict = auditStoryText({ title, summary }, otherLang);
    if (verdict.ok) {
      item.titleTranslated = title;
      item.summaryTranslated = summary;
      item.quality = { ...(item.quality ?? {}), audited: true, bilingual: true };
    } else {
      rejected(item, `translation/${otherLang}`, verdict);
    }
  } else if (title || summary) {
    // Half a translation is not a translation. Rendering a translated headline
    // over an untranslated body reads as a bug to anyone who can read both.
    rejected(item, `translation/${otherLang}`, {
      ok: false,
      findings: [
        {
          code: "empty",
          severity: "fatal",
          detail: title ? "headline without body" : "body without headline",
        },
      ],
    });
  }
}

/**
 * One line per rejection, sampled rather than exhaustive.
 *
 * A model having a bad minute can fail hundreds of items in one pass, and a log
 * line each turns a signal into a wall. The counter is what tells you whether
 * this is one odd story or the whole batch.
 */
let rejectionCount = 0;
const REJECTION_LOG_LIMIT = 12;

function rejected(item: NewsItem, stage: string, verdict: AuditResult): void {
  rejectionCount++;
  if (rejectionCount <= REJECTION_LOG_LIMIT) {
    console.warn(
      `[audit] dropped ${stage} for ${item.sourceName} — ${formatFindings(verdict)}`,
    );
  } else if (rejectionCount === REJECTION_LOG_LIMIT + 1) {
    console.warn("[audit] further rejections suppressed for this process");
  }
}

/** Decode first so escaped markup is revealed, then strip what it revealed. */
function cleanModelText(text: string): string {
  if (!text) return "";
  return htmlToText(decodeEntities(text));
}

/**
 * The feed as a reader should see it.
 *
 * The gate lives here rather than inside the cached aggregation so that the
 * policy is applied per request: `unstable_cache` holds every story with its
 * verdict, and what is published is decided fresh each time. Changing
 * PUBLISH_POLICY takes effect on the next request rather than on the next cache
 * turnover, and the archive keeps the stories the gate withheld.
 */
export async function getPublishedFeed(): Promise<AggregatedFeed> {
  const feed = await getCachedFeed();
  const gate = applyPublishGate(feed.items);

  if (gate.withheld > 0) {
    const why = Object.entries(gate.reasons)
      .map(([reason, n]) => `${n} ${reason}`)
      .join(", ");
    console.info(
      `[publish] policy=${gate.policy} — ${gate.published.length}/${feed.items.length} ` +
        `published, ${gate.withheld} withheld (${why})`,
    );
  }

  // A policy withholding most of the feed is indistinguishable from an
  // aggregator that stopped working, and the two need opposite responses.
  if (feed.items.length > 0 && gate.published.length < feed.items.length * 0.25) {
    console.warn(
      `[publish] PUBLISH_POLICY=${gate.policy} is withholding ` +
        `${Math.round((gate.withheld / feed.items.length) * 100)}% of the feed. ` +
        "That is what the policy asks for; check it is what you meant.",
    );
  }

  return { ...feed, items: gate.published };
}

export const getCachedFeed = unstable_cache(
  aggregateAllSources,
  ["aggregated-news-feed"],
  {
    revalidate: 300,
    tags: ["news-feed"],
  },
);
