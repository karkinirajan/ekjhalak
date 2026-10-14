import { strict as assert } from "node:assert";
import { beforeEach, describe, it } from "node:test";
import {
  DAILY_TOKEN_BUDGET,
  __resetLedgerForTests,
  batchTokenEstimate,
  recordSpend,
  syncLedgerFrom429,
  tokensRemaining,
  tokensSpentToday,
} from "./token-ledger";

beforeEach(() => {
  __resetLedgerForTests();
});

describe("tokensRemaining", () => {
  it("starts the day with the whole budget", () => {
    assert.equal(tokensRemaining("summary"), DAILY_TOKEN_BUDGET);
  });

  it("falls by what was spent", () => {
    recordSpend("summary", 8_000);
    assert.equal(tokensRemaining("summary"), DAILY_TOKEN_BUDGET - 8_000);
  });

  it("never reports less than nothing left", () => {
    recordSpend("summary", DAILY_TOKEN_BUDGET * 2);
    assert.equal(tokensRemaining("summary"), 0);
  });
});

describe("syncLedgerFrom429", () => {
  // Groq's own figure beats anything this process can infer, and is the only
  // way a cold instance learns the day is already spent.
  it("adopts the figure Groq reports", () => {
    syncLedgerFrom429("summary",
      "Rate limit reached for model `openai/gpt-oss-120b` ... tokens per day (TPD): Limit 200000, Used 197745, Requested 8133.",
    );
    assert.equal(tokensSpentToday("summary"), 197_745);
  });

  it("leaves the ledger alone when the body carries no figure", () => {
    recordSpend("summary", 5_000);
    syncLedgerFrom429("summary",
      "Rate limit reached. Please try again later.");
    assert.equal(tokensSpentToday("summary"), 5_000);
  });

  // Two instances each counting their own spend must not let the lower one
  // talk the ledger back down.
  it("never lowers a count that is already higher", () => {
    recordSpend("summary", 150_000);
    syncLedgerFrom429("summary",
      "tokens per day (TPD): Limit 200000, Used 90000");
    assert.equal(tokensSpentToday("summary"), 150_000);
  });
});

describe("batchTokenEstimate", () => {
  it("starts at the assumed cost", () => {
    assert.equal(batchTokenEstimate("summary"), 8_500);
  });

  it("moves toward what batches actually cost", () => {
    const before = batchTokenEstimate("summary");
    recordSpend("summary", 20_000);
    const after = batchTokenEstimate("summary");
    assert.ok(after > before, `expected the estimate to rise, got ${after}`);
    assert.ok(
      after < 20_000,
      `expected a smoothed estimate below the sample, got ${after}`,
    );
  });

  it("converges on a steady cost when it repeats", () => {
    for (let i = 0; i < 40; i++) recordSpend("summary", 12_000);
    assert.ok(
      Math.abs(batchTokenEstimate("summary") - 12_000) < 100,
      `expected convergence on 12000, got ${batchTokenEstimate("summary")}`,
    );
  });

  it("ignores a zero-token result rather than collapsing the estimate", () => {
    const before = batchTokenEstimate("summary");
    recordSpend("summary", 0);
    assert.equal(batchTokenEstimate("summary"), before);
  });
});

describe("the cap arithmetic enrichStories performs", () => {
  // Mirrors the computation in lib/summarizer.ts: a pass takes the least of
  // what exists, what one pass may take, and what the day still affords.
  const allowedBatches = (batches: number, maxPerPass: number) =>
    Math.max(
      0,
      Math.min(
        batches,
        maxPerPass,
        Math.floor(tokensRemaining("summary") / Math.max(1, batchTokenEstimate("summary"))),
      ),
    );

  it("caps a full pass to the per-pass limit when budget is plentiful", () => {
    assert.equal(allowedBatches(47, 3), 3);
  });

  it("gives nothing once the day is spent", () => {
    syncLedgerFrom429("summary",
      "tokens per day (TPD): Limit 200000, Used 197745");
    assert.equal(allowedBatches(47, 3), 0);
  });

  it("allows a partial pass when the remainder covers some batches", () => {
    // Set the spend through the 429 path rather than recordSpend, because
    // recordSpend also moves the batch estimate — which would change the very
    // divisor this assertion is about.
    const used = DAILY_TOKEN_BUDGET - batchTokenEstimate("summary") * 2;
    syncLedgerFrom429("summary", `tokens per day (TPD): Limit ${DAILY_TOKEN_BUDGET}, Used ${used}`);
    assert.equal(allowedBatches(47, 3), 2);
  });

  it("never asks for more batches than exist", () => {
    assert.equal(allowedBatches(1, 3), 1);
  });
});

describe("the two purposes are metered separately", () => {
  // Groq meters per organization per MODEL, not per key — three keys from one
  // account share one 200,000-token pot, which was verified by exhausting it on
  // one key and watching the other two report the same org and the same figure.
  //
  // What makes the two stages independent is therefore the model, not the key:
  // summarizing runs on gpt-oss-120b and translating on qwen3.8-27b, so they
  // draw from different pools. One shared counter here would refuse work that
  // the other model still had budget for.
  it("spending on one does not reduce the other", () => {
    recordSpend("summary", DAILY_TOKEN_BUDGET);
    assert.equal(tokensRemaining("summary"), 0);
    assert.equal(tokensRemaining("translation"), DAILY_TOKEN_BUDGET);
  });

  it("a 429 on one key does not shut down the other", () => {
    syncLedgerFrom429(
      "translation",
      "tokens per day (TPD): Limit 200000, Used 199000",
    );
    assert.equal(tokensSpentToday("translation"), 199_000);
    assert.equal(tokensSpentToday("summary"), 0);
  });

  it("learns each job's batch cost independently", () => {
    for (let i = 0; i < 40; i++) recordSpend("summary", 12_000);
    for (let i = 0; i < 40; i++) recordSpend("translation", 4_000);
    assert.ok(
      batchTokenEstimate("summary") > batchTokenEstimate("translation") * 2,
      `summary ${batchTokenEstimate("summary")} should far exceed translation ${batchTokenEstimate("translation")}`,
    );
  });

  it("gives each purpose the full daily budget", () => {
    assert.equal(tokensRemaining("summary"), DAILY_TOKEN_BUDGET);
    assert.equal(tokensRemaining("translation"), DAILY_TOKEN_BUDGET);
  });
});
