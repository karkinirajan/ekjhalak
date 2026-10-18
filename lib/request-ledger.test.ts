import { strict as assert } from "node:assert";
import { beforeEach, describe, it } from "node:test";

import {
  DAILY_REQUEST_BUDGET,
  MINUTE_REQUEST_LIMIT,
  __resetRequestLedgerForTests,
  msUntilRequestSlot,
  recordRequestSpend,
  requestsRemaining,
  requestsUsedToday,
  syncRequestLedgerFrom429,
} from "./request-ledger";

beforeEach(() => {
  __resetRequestLedgerForTests();
});

describe("the daily request allowance", () => {
  it("starts the day whole", () => {
    assert.equal(requestsRemaining(), DAILY_REQUEST_BUDGET);
  });

  it("falls by what was spent", () => {
    recordRequestSpend();
    recordRequestSpend();
    assert.equal(requestsRemaining(), DAILY_REQUEST_BUDGET - 2);
    assert.equal(requestsUsedToday(), 2);
  });

  it("never reports less than nothing left", () => {
    recordRequestSpend(DAILY_REQUEST_BUDGET * 2);
    assert.equal(requestsRemaining(), 0);
  });
});

describe("syncRequestLedgerFrom429", () => {
  // The refusal reports the LIMIT, not the usage — and the refusal itself is
  // proof the whole limit is gone, so the limit is what gets recorded. This is
  // the only way a cold instance learns the day is already spent.
  it("adopts the figure OpenRouter reports", () => {
    syncRequestLedgerFrom429(
      "Rate limit exceeded: free-models-per-day. You have exceeded your limit of 50 requests per day.",
    );
    assert.equal(requestsUsedToday(), 50);
  });

  it("reads the terser phrasing too", () => {
    syncRequestLedgerFrom429("rate-limited: 1000 per-day");
    assert.equal(requestsUsedToday(), 1_000);
  });

  it("leaves the ledger alone when the body carries no figure", () => {
    recordRequestSpend(5);
    syncRequestLedgerFrom429("Too Many Requests. Please try again later.");
    assert.equal(requestsUsedToday(), 5);
  });

  // Several warm instances each count their own spend, so the lower figure is
  // the one that is wrong. Letting a refusal talk the count back down would
  // reopen a budget that is actually closed.
  it("never lowers a count that is already higher", () => {
    recordRequestSpend(400);
    syncRequestLedgerFrom429("limit of 50 requests per day");
    assert.equal(requestsUsedToday(), 400);
  });
});

describe("the per-minute cap", () => {
  it("leaves room while under the limit", () => {
    recordRequestSpend(MINUTE_REQUEST_LIMIT - 1);
    assert.equal(msUntilRequestSlot(), 0);
  });

  it("asks the caller to wait once the minute is full", () => {
    recordRequestSpend(MINUTE_REQUEST_LIMIT);
    const wait = msUntilRequestSlot();
    assert.ok(
      wait > 0 && wait <= 60_000,
      `expected a wait inside the minute, got ${wait}`,
    );
  });

  // The daily count is cumulative and the minute count is a rolling window;
  // one must not be read as the other. A pass that has spent 30 requests over
  // an hour is not rate-limited, and a ledger that conflated the two would
  // stall the pipeline for the rest of the day.
  it("is independent of the daily count", () => {
    recordRequestSpend(MINUTE_REQUEST_LIMIT);
    assert.ok(msUntilRequestSlot() > 0);
    assert.equal(requestsUsedToday(), MINUTE_REQUEST_LIMIT);
    __resetRequestLedgerForTests();
    assert.equal(msUntilRequestSlot(), 0);
  });
});
