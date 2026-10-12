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
    assert.equal(tokensRemaining(), DAILY_TOKEN_BUDGET);
  });

  it("falls by what was spent", () => {
    recordSpend(8_000);
    assert.equal(tokensRemaining(), DAILY_TOKEN_BUDGET - 8_000);
  });

  it("never reports less than nothing left", () => {
    recordSpend(DAILY_TOKEN_BUDGET * 2);
    assert.equal(tokensRemaining(), 0);
  });
});

describe("syncLedgerFrom429", () => {
  // Groq's own figure beats anything this process can infer, and is the only
  // way a cold instance learns the day is already spent.
  it("adopts the figure Groq reports", () => {
    syncLedgerFrom429(
      "Rate limit reached for model `openai/gpt-oss-120b` ... tokens per day (TPD): Limit 200000, Used 197745, Requested 8133.",
    );
    assert.equal(tokensSpentToday(), 197_745);
  });

  it("leaves the ledger alone when the body carries no figure", () => {
    recordSpend(5_000);
    syncLedgerFrom429("Rate limit reached. Please try again later.");
    assert.equal(tokensSpentToday(), 5_000);
  });

  // Two instances each counting their own spend must not let the lower one
  // talk the ledger back down.
  it("never lowers a count that is already higher", () => {
    recordSpend(150_000);
    syncLedgerFrom429("tokens per day (TPD): Limit 200000, Used 90000");
    assert.equal(tokensSpentToday(), 150_000);
  });
});

describe("batchTokenEstimate", () => {
  it("starts at the assumed cost", () => {
    assert.equal(batchTokenEstimate(), 8_500);
  });

  it("moves toward what batches actually cost", () => {
    const before = batchTokenEstimate();
    recordSpend(20_000);
    const after = batchTokenEstimate();
    assert.ok(after > before, `expected the estimate to rise, got ${after}`);
    assert.ok(
      after < 20_000,
      `expected a smoothed estimate below the sample, got ${after}`,
    );
  });

  it("converges on a steady cost when it repeats", () => {
    for (let i = 0; i < 40; i++) recordSpend(12_000);
    assert.ok(
      Math.abs(batchTokenEstimate() - 12_000) < 100,
      `expected convergence on 12000, got ${batchTokenEstimate()}`,
    );
  });

  it("ignores a zero-token result rather than collapsing the estimate", () => {
    const before = batchTokenEstimate();
    recordSpend(0);
    assert.equal(batchTokenEstimate(), before);
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
        Math.floor(tokensRemaining() / Math.max(1, batchTokenEstimate())),
      ),
    );

  it("caps a full pass to the per-pass limit when budget is plentiful", () => {
    assert.equal(allowedBatches(47, 3), 3);
  });

  it("gives nothing once the day is spent", () => {
    syncLedgerFrom429("tokens per day (TPD): Limit 200000, Used 197745");
    assert.equal(allowedBatches(47, 3), 0);
  });

  it("allows a partial pass when the remainder covers some batches", () => {
    // Set the spend through the 429 path rather than recordSpend, because
    // recordSpend also moves the batch estimate — which would change the very
    // divisor this assertion is about.
    const used = DAILY_TOKEN_BUDGET - batchTokenEstimate() * 2;
    syncLedgerFrom429(`tokens per day (TPD): Limit ${DAILY_TOKEN_BUDGET}, Used ${used}`);
    assert.equal(allowedBatches(47, 3), 2);
  });

  it("never asks for more batches than exist", () => {
    assert.equal(allowedBatches(1, 3), 1);
  });
});
