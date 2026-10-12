import { strict as assert } from "node:assert";
import { afterEach, describe, it } from "node:test";
import { envInt, envOr, envString } from "./env";

const KEY = "EKJHALAK_ENV_TEST";

afterEach(() => {
  delete process.env[KEY];
});

describe("envString", () => {
  it("returns the value when one is set", () => {
    process.env[KEY] = "hello";
    assert.equal(envString(KEY), "hello");
  });

  it("returns undefined when the variable is absent", () => {
    assert.equal(envString(KEY), undefined);
  });

  // The whole reason this module exists. `X=` in a .env file or an empty
  // dashboard field is not `undefined`, so `??` passes it through — which sent
  // every confirmation email with an empty From header and got a 422 naming a
  // domain that was verified and working.
  it("treats a declared-but-empty variable as absent", () => {
    process.env[KEY] = "";
    assert.equal(envString(KEY), undefined);
  });

  it("treats whitespace as absent", () => {
    process.env[KEY] = "   ";
    assert.equal(envString(KEY), undefined);
  });

  it("trims a value that has surrounding whitespace", () => {
    process.env[KEY] = "  spaced  ";
    assert.equal(envString(KEY), "spaced");
  });
});

describe("envOr", () => {
  it("prefers a real value over the fallback", () => {
    process.env[KEY] = "real";
    assert.equal(envOr(KEY, "fallback"), "real");
  });

  it("falls back when the variable is empty", () => {
    process.env[KEY] = "";
    assert.equal(envOr(KEY, "fallback"), "fallback");
  });

  it("falls back when the variable is absent", () => {
    assert.equal(envOr(KEY, "fallback"), "fallback");
  });
});

describe("envInt", () => {
  it("parses a set value", () => {
    process.env[KEY] = "4200";
    assert.equal(envInt(KEY, 15000), 4200);
  });

  it("falls back when absent", () => {
    assert.equal(envInt(KEY, 15000), 15000);
  });

  // `Number.parseInt("", 10)` is NaN, and a NaN budget disables the stage it
  // governs without failing: every `Date.now() >= deadline` is false and every
  // `Math.min` is NaN, so nothing runs and nothing complains.
  it("falls back when the variable is empty rather than yielding NaN", () => {
    process.env[KEY] = "";
    assert.equal(envInt(KEY, 15000), 15000);
  });

  it("falls back when the value is not a number", () => {
    process.env[KEY] = "soon";
    assert.equal(envInt(KEY, 15000), 15000);
  });

  it("clamps to min when one is given", () => {
    process.env[KEY] = "-5";
    assert.equal(envInt(KEY, 15000, 0), 0);
  });

  it("leaves a negative value alone when no min is given", () => {
    process.env[KEY] = "-5";
    assert.equal(envInt(KEY, 15000), -5);
  });
});
