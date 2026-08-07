import assert from "node:assert/strict";
import test from "node:test";

import { auditStoryText, auditText, type AuditCode } from "./text-audit";

const codes = (r: { findings: { code: AuditCode }[] }) => r.findings.map((f) => f.code);

const EN =
  "Nepal Rastra Bank raised the policy rate by a quarter point on Tuesday, " +
  "citing persistent inflation in food and fuel. The decision was announced " +
  "after a meeting of the monetary policy committee in Kathmandu.";

const NP =
  "नेपाल राष्ट्र बैंकले मंगलबार नीतिगत दर बढाएको छ। खाद्य र इन्धनमा " +
  "देखिएको मूल्यवृद्धिलाई कारण देखाउँदै बैंकले यो निर्णय गरेको हो। " +
  "काठमाडौंमा बसेको मौद्रिक नीति समितिको बैठकपछि यो घोषणा गरिएको हो।";

test("clean English and Nepali prose pass", () => {
    assert.equal(auditText(EN, { lang: "en" }).ok, true);
    assert.equal(auditText(NP, { lang: "np" }).ok, true);
});

test("empty and fragment text fail", () => {
    assert.deepEqual(codes(auditText("", { lang: "en" })), ["empty"]);
    assert.deepEqual(codes(auditText("   ", { lang: "en" })), ["empty"]);
    assert.ok(codes(auditText("Too short.", { lang: "en" })).includes("too-short"));
});

// ── Script mixing: the failure the user actually reported ───────────────────

test("Devanagari inside English text is fatal", () => {
    const mixed = EN.replace("Kathmandu", "काठमाडौं महानगरपालिका कार्यालय");
    const r = auditText(mixed, { lang: "en" });
    assert.equal(r.ok, false);
    assert.ok(codes(r).includes("script-mixed"));
});

test("an English passage marked Nepali is fatal", () => {
    const r = auditText(EN, { lang: "np" });
    assert.equal(r.ok, false);
    assert.ok(codes(r).includes("wrong-script"));
});

test("Nepali keeps its borrowed acronyms, numerals and names", () => {
    // Real Nepali newswriting. None of this is a defect and none of it may fail.
    const real =
        "नेपाल राष्ट्र बैंक (NRB) ले सन् 2026 को दोस्रो त्रैमासिकमा IPO निष्कासन " +
        "सम्बन्धी नयाँ निर्देशिका जारी गरेको छ। SEBON सँगको समन्वयमा यो " +
        "निर्देशिका तयार पारिएको हो।";
    assert.equal(auditText(real, { lang: "np" }).ok, true);
});

test("a Nepali passage that is mostly English is fatal", () => {
    const half =
        "नेपाल राष्ट्र बैंक said the policy rate would rise by a quarter point " +
        "on Tuesday, citing persistent inflation across food and fuel markets.";
    const r = auditText(half, { lang: "np" });
    assert.equal(r.ok, false);
    assert.ok(codes(r).includes("script-mixed") || codes(r).includes("wrong-script"));
});

// ── Mechanical damage ───────────────────────────────────────────────────────

test("mojibake and replacement characters are fatal", () => {
    assert.ok(codes(auditText(`${EN} Ã¤Ã¶`, { lang: "en" })).includes("encoding-artifact"));
    assert.ok(codes(auditText(EN.replace("Nepal", "Ne�pal"), { lang: "en" })).includes("encoding-artifact"));
});

test("leaked markup and entities are fatal", () => {
    assert.ok(codes(auditText(`<p>${EN}</p>`, { lang: "en" })).includes("markup-leak"));
    assert.ok(codes(auditText(EN.replace("and", "&amp;"), { lang: "en" })).includes("entity-leak"));
    assert.ok(codes(auditText(NP.replace("बैंकले", "बैंक&zwj;ले"), { lang: "np" })).includes("entity-leak"));
});

// ── The model talking about itself ──────────────────────────────────────────

test("model preamble is fatal", () => {
    for (const prefix of ["Here is the summary: ", "Sure! ", "Summary: ", "**Summary** ", "अनुवाद: "]) {
        const lang = /[ऀ-ॿ]/.test(prefix) ? "np" : "en";
        const body = lang === "np" ? NP : EN;
        const r = auditText(prefix + body, { lang });
        assert.ok(codes(r).includes("model-preamble"), `missed: ${prefix}`);
    }
});

test("ordinary prose containing 'here is' mid-sentence is not a preamble", () => {
    const fine =
        "The minister said the plan here is to complete the road by next winter, " +
        "and that funding had already been allocated for the first phase of work.";
    assert.equal(auditText(fine, { lang: "en" }).ok, true);
});

test("a model refusal is fatal", () => {
    const r = auditText(`I'm sorry, I cannot provide a summary of this article. ${EN}`, { lang: "en" });
    assert.ok(codes(r).includes("model-refusal"));
});

// ── Completeness ────────────────────────────────────────────────────────────

test("text that stops mid-thought is fatal", () => {
    assert.ok(codes(auditText("The committee met on Tuesday and agreed to raise the rate by a quarter", { lang: "en" })).includes("truncated"));
    assert.ok(codes(auditText("The committee met on Tuesday to discuss the rate and", { lang: "en" })).includes("truncated"));
    assert.ok(codes(auditText("नेपाल राष्ट्र बैंकले मंगलबार नीतिगत दर बढाएको छ र", { lang: "np" })).includes("truncated"));
});

test("an ellipsis or a closing quote still counts as ending", () => {
    assert.equal(auditText(`${EN.slice(0, -1)}…`, { lang: "en" }).ok, true);
    assert.equal(auditText(`${EN.slice(0, -1)}."`, { lang: "en" }).ok, true);
});

test("a looping sentence is flagged but not fatal", () => {
    const looped = `${EN} ${EN.split(". ")[0]}. ${EN.split(". ")[0]}.`;
    const r = auditText(looped, { lang: "en" });
    assert.ok(codes(r).includes("repetition"));
    assert.equal(r.ok, true, "degeneration is worth seeing, not worth withholding a story for");
});

// ── Says nothing new ────────────────────────────────────────────────────────

test("a summary that only restates the headline is fatal", () => {
    const title = "Nepal Rastra Bank raises the policy rate by a quarter point";
    const r = auditText(`${title}.`, { lang: "en", title, minChars: 10 });
    assert.ok(codes(r).includes("headline-echo"));
});

test("a summary that opens with the headline and continues is fine", () => {
    const title = "Nepal Rastra Bank raises the policy rate";
    const r = auditText(
        `${title} by a quarter point on Tuesday, citing food and fuel inflation. ` +
        `The committee met in Kathmandu and published its decision the same evening.`,
        { lang: "en", title },
    );
    assert.equal(r.ok, true);
});

// ── Whole-story audit ───────────────────────────────────────────────────────

test("auditStoryText labels which field failed", () => {
    const r = auditStoryText({ title: "काठमाडौं", summary: EN }, "np");
    assert.equal(r.ok, false);
    assert.ok(r.findings.some((f) => f.detail.startsWith("summary:")));
});

test("a clean bilingual pair passes in both directions", () => {
    assert.equal(
        auditStoryText({ title: "Nepal Rastra Bank raises the policy rate", summary: EN }, "en").ok,
        true,
    );
    assert.equal(
        auditStoryText({ title: "नेपाल राष्ट्र बैंकले नीतिगत दर बढायो", summary: NP }, "np").ok,
        true,
    );
});

// ── Headlines are not prose ─────────────────────────────────────────────────

test("a headline needs no terminal punctuation", () => {
    const r = auditText("Nepal Rastra Bank raises the policy rate", {
        lang: "en",
        minChars: 10,
        requireTerminalPunctuation: false,
    });
    assert.equal(r.ok, true, "a headline ending on a word is correctly punctuated");
});

test("a headline cut mid-thought is still fatal", () => {
    const r = auditText("Nepal Rastra Bank raises the", {
        lang: "en",
        minChars: 10,
        requireTerminalPunctuation: false,
    });
    assert.ok(codes(r).includes("truncated"));
});
