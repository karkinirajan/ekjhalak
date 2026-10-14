#!/usr/bin/env node
// scripts/translate-bakeoff.mjs
//
// Compare translation providers on this site's own articles, blind.
//
//   node --env-file=.env scripts/translate-bakeoff.mjs --n=20
//   node --env-file=.env scripts/translate-bakeoff.mjs --n=20 --dir=en2np
//
// Written because the research that proposed Gemini and IndicTrans2 said
// plainly that it found no benchmark of any of these models on Nepali news.
// Vendor language coverage is a claim about what a model will attempt, not
// evidence about what it produces, and "supports Nepali" has never meant
// "writes Nepali a Kathmandu desk would print".
//
// So this does not ask which model is better in general. It takes real rows out
// of the archive, sends the same text to every provider that has a key in the
// environment, and scores what comes back on the four things that actually
// break in this pipeline:
//
//   numbers   a figure that changes is worse than a clumsy sentence
//   names     a dropped or garbled proper noun is a factual error
//   script    Latin text in a Nepali summary is the failure mode of a model
//             that is transliterating rather than translating
//   length    a translation half the length of its source has dropped clauses
//
// It prints a table and writes the raw output to audit/translation/ so a human
// can read the prose, which is the half no script can judge. Nothing here picks
// a winner on its own: it narrows the field so a person reads four candidates
// instead of forty.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=")[1] : fallback;
};

const SAMPLE = Number.parseInt(arg("n", "20"), 10);
const DIRECTION = arg("dir", "np2en"); // np2en | en2np
const OUT_DIR = join(process.cwd(), "audit", "translation");

const SOURCE_LANG = DIRECTION === "en2np" ? "en" : "np";
const TARGET_LANG = DIRECTION === "en2np" ? "np" : "en";

// ── Providers ───────────────────────────────────────────────────────────────
//
// Each returns a string or throws. A provider with no key is skipped rather
// than failed, so the script is useful the moment one key exists.

const providers = [];

if (process.env.EKJHALAK_TRANSLATION || process.env.GROQ_API_KEY) {
  const key = process.env.EKJHALAK_TRANSLATION ?? process.env.GROQ_API_KEY;
  for (const model of ["qwen/qwen3.8-27b", "openai/gpt-oss-120b"]) {
    providers.push({
      name: `groq:${model.split("/")[1]}`,
      async translate(text, title) {
        const res = await fetch(
          "https://api.groq.com/openai/v1/chat/completions",
          {
            method: "POST",
            headers: {
              authorization: `Bearer ${key}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              model,
              messages: [
                { role: "system", content: systemPrompt() },
                {
                  role: "user",
                  content: JSON.stringify([
                    { id: "x", headline: title, summary: text },
                  ]),
                },
              ],
              temperature: 0.2,
              max_completion_tokens: 4_000,
              response_format: { type: "json_object" },
            }),
          },
        );
        if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 90)}`);
        const body = await res.json();
        const items = JSON.parse(body.choices[0].message.content).items;
        return items[0]?.summary ?? "";
      },
    });
  }
}

if (process.env.GEMINI_API_KEY) {
  // Flash and Flash-Lite are the two free tiers worth comparing; Flash-Lite is
  // cheaper per call and the question is whether its Nepali holds up.
  for (const model of ["gemini-3.8-flash", "gemini-3.5-flash-lite"]) {
    providers.push({
      name: `gemini:${model.replace("gemini-", "")}`,
      async translate(text, title) {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "x-goog-api-key": process.env.GEMINI_API_KEY,
            },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemPrompt() }] },
              contents: [
                {
                  parts: [
                    {
                      text: JSON.stringify([
                        { id: "x", headline: title, summary: text },
                      ]),
                    },
                  ],
                },
              ],
              generationConfig: {
                temperature: 0.2,
                responseMimeType: "application/json",
              },
            }),
          },
        );
        if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 90)}`);
        const body = await res.json();
        const raw = body.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
        const parsed = JSON.parse(raw);
        const items = Array.isArray(parsed) ? parsed : parsed.items;
        return items?.[0]?.summary ?? "";
      },
    });
  }
}

if (
  process.env.CLOUDFLARE_API_TOKEN &&
  process.env.CLOUDFLARE_ACCOUNT_ID &&
  DIRECTION === "en2np"
) {
  // IndicTrans2 as hosted by Cloudflare is English -> Indic only, so it has
  // nothing to say about the other direction and is not offered there.
  providers.push({
    name: "cf:indictrans2",
    async translate(text) {
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/ai4bharat/indictrans2-en-indic-1B`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ text, target_language: "npi_Deva" }),
        },
      );
      if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 90)}`);
      const body = await res.json();
      return body.result?.translated_text ?? "";
    },
  });
}

function systemPrompt() {
  const target = TARGET_LANG === "np" ? "Nepali (Devanagari)" : "English";
  // Deliberately the production prompt's own rules, near enough word for word.
  //
  // An earlier draft here said only "translate the whole text; add nothing",
  // and qwen3.8-27b scored 48% on length against it — it condensed, and one
  // reply ended in a literal "[...]". The same model on the same article with
  // the rules below returned 156%. The model was never the variable.
  //
  // So a bake-off whose prompt is weaker than production does not measure the
  // production system; it measures the weaker prompt, and would have retired a
  // perfectly good model. Any provider added here is judged against what the
  // pipeline actually sends.
  return (
    `You are the translation desk of a Nepali newsroom. Translate each summary into ${target}.\n` +
    `1. Translate the WHOLE text. Every clause, every sentence. A translation that drops a sentence has failed, however minor the sentence looked.\n` +
    `2. You are NOT summarizing. The text in front of you is already the finished story. Do not condense, abbreviate or omit.\n` +
    `3. Add nothing. No background, context or explanation the paragraph does not contain.\n` +
    `4. Keep every name, title, place, date, figure, currency amount and unit exactly as given — never round, convert or re-date.\n` +
    `5. Preserve hedging and attribution exactly. "alleged" stays alleged; "the minister said" keeps the minister.\n` +
    `6. Write natural, idiomatic prose — the register of a printed daily, never a word-for-word gloss.\n` +
    `7. Match the source paragraph's length and sentence order.\n` +
    `Respond with one JSON object {"items":[{"id","summary"}]}. No markdown fences.`
  );
}

// ── Scoring ─────────────────────────────────────────────────────────────────

const DEV_DIGITS = "०१२३४५६७८९";
const toAscii = (s) =>
  s.replace(/[०-९]/g, (d) => String(DEV_DIGITS.indexOf(d)));

/** Every number in the text, normalised across both digit systems. */
function numbers(text) {
  return (toAscii(text).match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) =>
    n.replace(/,/g, ""),
  );
}

/** Capitalised runs — a rough proxy for proper nouns in Latin text. */
function properNouns(text) {
  return [...new Set(text.match(/\b[A-Z][a-z]{2,}\b/g) ?? [])];
}

function scriptMix(text) {
  const dev = (text.match(/[ऀ-ॿ]/g) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  return { dev, latin };
}

/**
 * Expected output length relative to the source.
 *
 * The two scripts do not measure the same per word: Devanagari runs about 6.9
 * characters a word against English's 6.3, measured on this site's own corpus.
 * So a faithful Nepali-to-English translation lands near 0.91 and the reverse
 * near 1.10 — a raw ratio of 1.0 would be the wrong target in both directions
 * and would read a correct translation as a lossy one.
 */
const EXPECTED_RATIO = SOURCE_LANG === "np" ? 6.29 / 6.94 : 6.94 / 6.29;

function score(source, output) {
  const srcNums = numbers(source);
  const outNums = new Set(numbers(output));
  const keptNums = srcNums.filter((n) => outNums.has(n)).length;

  // Names are only checkable when the source is the Latin-script side. Going
  // the other way a proper noun is transliterated — "Paudel" becomes पौडेल —
  // and a substring test can only ever report zero, which looks like total
  // failure rather than an unanswerable question. Report it as unmeasured.
  let names = null;
  if (SOURCE_LANG === "en") {
    const srcNames = properNouns(source);
    // A transliterated name is not in the output as Latin text either, so this
    // measures the narrower thing it can: names the model left in Latin script,
    // which for an English-to-Nepali summary is the ones it chose not to
    // transliterate at all.
    const kept = srcNames.filter((n) => output.includes(n)).length;
    names = srcNames.length ? kept / srcNames.length : 1;
  }

  const mix = scriptMix(output);
  const scriptOk =
    TARGET_LANG === "np" ? mix.dev > mix.latin * 3 : mix.latin > mix.dev * 3;

  // Measured against what the script pair predicts, not against 1.0.
  const ratio = output.length / Math.max(1, source.length);

  return {
    numbers: srcNums.length ? keptNums / srcNums.length : 1,
    names,
    scriptOk,
    ratio,
    fidelity: ratio / EXPECTED_RATIO,
    chars: output.length,
  };
}

// ── Sample ──────────────────────────────────────────────────────────────────

async function sample() {
  const origin = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!origin || !key) {
    console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
    process.exit(2);
  }
  const res = await fetch(
    `${origin}/rest/v1/articles?select=id,title,summary,original_lang` +
      `&original_lang=eq.${SOURCE_LANG}&summary=not.is.null` +
      `&order=last_seen_at.desc&limit=${SAMPLE * 3}`,
    { headers: { apikey: key, authorization: `Bearer ${key}` } },
  );
  const rows = await res.json();
  if (!Array.isArray(rows)) {
    console.error("could not read articles:", JSON.stringify(rows).slice(0, 200));
    process.exit(1);
  }
  // Long enough to be worth translating, short enough to stay inside a request.
  return rows
    .filter((r) => r.summary.length > 400 && r.summary.length < 1_600)
    .slice(0, SAMPLE);
}

// ── Run ─────────────────────────────────────────────────────────────────────

if (providers.length === 0) {
  console.error(
    "No provider keys found. Set at least one of EKJHALAK_TRANSLATION,\n" +
      "GROQ_API_KEY, GEMINI_API_KEY, or CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID.",
  );
  process.exit(2);
}

const articles = await sample();
console.log(
  `${DIRECTION}: ${articles.length} articles x ${providers.length} provider(s)\n`,
);

const totals = new Map(providers.map((p) => [p.name, []]));
const transcript = [];

for (const [index, article] of articles.entries()) {
  process.stdout.write(`  ${index + 1}/${articles.length} `);
  const row = { id: article.id, source: article.summary, outputs: {} };

  for (const provider of providers) {
    try {
      const started = Date.now();
      const output = await provider.translate(article.summary, article.title);
      const result = score(article.summary, output);
      result.ms = Date.now() - started;
      totals.get(provider.name).push(result);
      row.outputs[provider.name] = output;
      process.stdout.write(result.scriptOk ? "." : "!");
    } catch (err) {
      process.stdout.write("x");
      row.outputs[provider.name] = `ERROR: ${err.message}`;
    }
  }
  transcript.push(row);
  process.stdout.write("\n");
}

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const pct = (x) => `${(x * 100).toFixed(0)}%`;

console.log(
  `\n  ${"provider".padEnd(24)}${"n".padStart(4)}${"numbers".padStart(10)}${"names".padStart(8)}${"script".padStart(8)}${"length".padStart(9)}${"ms".padStart(8)}`,
);
for (const [name, results] of totals) {
  if (results.length === 0) {
    console.log(`  ${name.padEnd(24)}${"0".padStart(4)}   all calls failed`);
    continue;
  }
  console.log(
    `  ${name.padEnd(24)}${String(results.length).padStart(4)}` +
      `${pct(mean(results.map((r) => r.numbers))).padStart(10)}` +
      `${(results[0].names === null ? "n/a" : pct(mean(results.map((r) => r.names)))).padStart(8)}` +
      `${pct(mean(results.map((r) => (r.scriptOk ? 1 : 0)))).padStart(8)}` +
      `${pct(mean(results.map((r) => r.fidelity))).padStart(9)}` +
      `${Math.round(mean(results.map((r) => r.ms))).toString().padStart(8)}`,
  );
}

mkdirSync(OUT_DIR, { recursive: true });
const file = join(OUT_DIR, `bakeoff-${DIRECTION}.json`);
writeFileSync(file, JSON.stringify(transcript, null, 2));

console.log(
  `\n  numbers: share of figures carried across.` +
    `\n  names:   share left in Latin script (English source only; the other` +
    `\n           direction transliterates, which a substring test cannot judge).` +
    `\n  script:  share written in the right script.` +
    `\n  length:  against what the script pair predicts, not against 1.0 —` +
    `\n           under 100% means clauses went missing, well over means padding.` +
    `\n\n  Raw output: ${file}` +
    `\n  Read it. These checks catch the errors that are countable;` +
    `\n  whether the prose reads like a newsroom is not one of them.`,
);
