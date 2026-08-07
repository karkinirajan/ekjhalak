// lib/publish-gate.ts
// What is allowed in front of a reader, and under whose rule.
//
// The pipeline produces stories at four different levels of assurance, and which
// of them count as "published" is a policy, not a fact about the code:
//
//   all       every story with body text
//   audited   plus: every reader-facing string cleared lib/text-audit.ts
//   bilingual plus: both languages present and both audited
//   verified  plus: a model confirmed the summary faithful to the source and
//             the translation faithful to the summary
//
// Each level is a superset of the one above it, so raising the policy can only
// ever remove stories, never add one.
//
// **The strictest policy is not the default, and that is deliberate.**
// `verified` is only reachable in volume once enrichment results survive between
// serverless invocations — today they do not (lib/enrichment-cache.ts is
// in-process), so a pass verifies a handful of stories and setting `verified`
// would empty the site rather than improve it. The mechanism is here, tested,
// and enforced; the level it runs at is one environment variable, and it becomes
// safe to raise the moment the archive is wired up. See development.md §1.
//
// Nothing here decides *quality* — lib/text-audit.ts and the verification pass
// already did. This decides what to do with their verdicts.

import type { NewsItem } from "./news-pipeline";

export type PublishPolicy = "all" | "audited" | "bilingual" | "verified";

const POLICIES: readonly PublishPolicy[] = [
  "all",
  "audited",
  "bilingual",
  "verified",
];

export const DEFAULT_POLICY: PublishPolicy = "audited";

/**
 * The policy in force.
 *
 * An unrecognised value falls back to the default and says so. Silently
 * treating `PUBLISH_POLICY=verfied` as "all" would be the worst of both: a
 * misconfiguration that looks like a working configuration.
 */
export function publishPolicy(): PublishPolicy {
  const raw = process.env.PUBLISH_POLICY?.trim().toLowerCase();
  if (!raw) return DEFAULT_POLICY;
  if ((POLICIES as readonly string[]).includes(raw)) return raw as PublishPolicy;
  console.warn(
    `[publish] PUBLISH_POLICY="${raw}" is not one of ${POLICIES.join(", ")} — using ${DEFAULT_POLICY}`,
  );
  return DEFAULT_POLICY;
}

/**
 * Does this story clear the bar?
 *
 * `quality` absent is treated as "nothing was checked", which passes `all` and
 * fails everything above it. That is the right reading: a story the enrichment
 * pass never reached carries no verdict, and no verdict is not a pass.
 *
 * The one asymmetry worth naming is inside `verified`. `quality.verified` is a
 * tri-state — true, false, or undefined for "the budget ran out before this one
 * was checked" — and only `true` publishes here. Under this policy an unchecked
 * story waits for the next pass, which is exactly what the policy is for.
 */
export function isPublishable(item: NewsItem, policy: PublishPolicy): boolean {
  if (!item.summary) return false;
  if (policy === "all") return true;

  const q = item.quality;
  if (!q?.audited) return false;
  if (policy === "audited") return true;

  if (!q.bilingual || !item.titleTranslated || !item.summaryTranslated) {
    return false;
  }
  if (policy === "bilingual") return true;

  return q.verified === true;
}

export interface GateResult {
  published: NewsItem[];
  withheld: number;
  policy: PublishPolicy;
  /** Count per reason, for the log line. */
  reasons: Record<string, number>;
}

/**
 * Apply the gate, and report what it cost.
 *
 * The count matters as much as the filter. A policy quietly withholding 95% of
 * the feed looks identical from the outside to an aggregator that stopped
 * working, and the two need very different responses — so the numbers are
 * returned rather than logged and forgotten.
 */
export function applyPublishGate(
  items: NewsItem[],
  policy: PublishPolicy = publishPolicy(),
): GateResult {
  const published: NewsItem[] = [];
  const reasons: Record<string, number> = {};
  const note = (why: string) => {
    reasons[why] = (reasons[why] ?? 0) + 1;
  };

  for (const item of items) {
    if (isPublishable(item, policy)) {
      published.push(item);
      continue;
    }
    if (!item.summary) note("no body text");
    else if (!item.quality?.audited) note("not audited");
    else if (!item.quality.bilingual) note("not bilingual");
    else if (item.quality.verified === false) note("failed verification");
    else note("not yet verified");
  }

  return {
    published,
    withheld: items.length - published.length,
    policy,
    reasons,
  };
}

/**
 * How much of the feed a stricter policy would cost, without applying it.
 *
 * So the decision to raise the policy is made from a number. Run it against a
 * live feed before flipping PUBLISH_POLICY, not after.
 */
export function previewPolicies(items: NewsItem[]): Record<PublishPolicy, number> {
  return Object.fromEntries(
    POLICIES.map((p) => [p, items.filter((i) => isPublishable(i, p)).length]),
  ) as Record<PublishPolicy, number>;
}
