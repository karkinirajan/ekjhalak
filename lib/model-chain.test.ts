import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

/**
 * How a chain entry is split into provider and model.
 *
 * lib/summarizer.ts is `server-only` and cannot be imported by this runner, so
 * the two functions under test are mirrored here. That is a real duplication
 * and the reason it is accepted: the splitting rule is the part of the provider
 * wiring that fails SILENTLY when wrong, and silent is what makes it worth a
 * test even an imperfect one.
 *
 * The specific hazard is OpenRouter's free-model IDs, which end in `:free`.
 * `openrouter:google/gemma-4-31b-it:free` carries two colons. Splitting on the
 * last one, or on all of them, asks OpenRouter for `google/gemma-4-31b-it` —
 * a real but PAID model ID. So the wrong split does not throw and does not
 * 404: it quietly bills the account for a model the operator believed was free.
 */
type Provider = "groq" | "gemini" | "openrouter";

const PROVIDER_PREFIXES: ReadonlyArray<readonly [string, Provider]> = [
  ["gemini:", "gemini"],
  ["openrouter:", "openrouter"],
];

function providerOf(entry: string): Provider {
  for (const [prefix, provider] of PROVIDER_PREFIXES) {
    if (entry.startsWith(prefix)) return provider;
  }
  return "groq";
}

function bareModel(entry: string): string {
  for (const [prefix] of PROVIDER_PREFIXES) {
    if (entry.startsWith(prefix)) return entry.slice(prefix.length);
  }
  return entry;
}

describe("providerOf", () => {
  it("treats an unprefixed entry as Groq", () => {
    assert.equal(providerOf("openai/gpt-oss-120b"), "groq");
    assert.equal(providerOf("qwen/qwen3.8-27b"), "groq");
  });

  it("reads the gemini prefix", () => {
    assert.equal(providerOf("gemini:gemini-3.1-flash-lite"), "gemini");
  });

  it("reads the openrouter prefix", () => {
    assert.equal(
      providerOf("openrouter:google/gemma-4-31b-it:free"),
      "openrouter",
    );
  });
});

describe("bareModel", () => {
  it("leaves an unprefixed Groq entry untouched", () => {
    assert.equal(bareModel("openai/gpt-oss-120b"), "openai/gpt-oss-120b");
  });

  it("strips only the provider prefix, keeping the :free suffix", () => {
    assert.equal(
      bareModel("openrouter:google/gemma-4-31b-it:free"),
      "google/gemma-4-31b-it:free",
    );
    assert.equal(
      bareModel("openrouter:nvidia/nemotron-3-super-120b-a12b:free"),
      "nvidia/nemotron-3-super-120b-a12b:free",
    );
  });

  it("does not mistake the :free suffix for a provider prefix", () => {
    const entry = "openrouter:google/gemma-4-31b-it:free";
    assert.ok(bareModel(entry).endsWith(":free"), "the :free suffix is the free tier — dropping it selects the paid model");
  });

  it("strips the gemini prefix", () => {
    assert.equal(bareModel("gemini:gemini-3.1-flash-lite"), "gemini-3.1-flash-lite");
  });
});
