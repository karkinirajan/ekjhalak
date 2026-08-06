import assert from "node:assert/strict";
import test from "node:test";

import { decodeEntities, htmlToText } from "./html-entities";

test("decodeEntities resolves named entities", () => {
  assert.equal(decodeEntities("A &amp; B"), "A & B");
  assert.equal(decodeEntities("&quot;quoted&quot;"), '"quoted"');
  assert.equal(decodeEntities("wait&hellip;"), "wait…");
});

test("decodeEntities resolves numeric Devanagari", () => {
  // Setopati serves its og:description like this. The chain this replaced
  // turned the whole string into spaces.
  const encoded = "&#2342;&#2369;&#2352;&#2381;&#2327;&#2366;";
  assert.equal(decodeEntities(encoded), "दुर्गा");
});

test("decodeEntities resolves hex entities", () => {
  assert.equal(decodeEntities("&#x0928;&#x0947;&#x092A;&#x093E;&#x0932;"), "नेपाल");
});

test("decodeEntities handles double encoding", () => {
  assert.equal(decodeEntities("&amp;#2344;"), "न");
});

test("decodeEntities leaves a bare ampersand alone", () => {
  // AT&T and Q&A appear unescaped in real headlines; &T; and &A; are not
  // entities, and blanking them produced "AT" and "Q".
  assert.equal(decodeEntities("AT&T and Q&A"), "AT&T and Q&A");
});

test("decodeEntities decodes angle brackets the same way in both forms", () => {
  // Safe because htmlToText strips tags before decoding and React escapes on
  // render. The point of the test is consistency: &lt; and &#60; are the same
  // character written two ways and must not decode differently.
  assert.equal(decodeEntities("&lt;b&gt;"), "<b>");
  assert.equal(decodeEntities("&#60;b&#62;"), "<b>");
});

test("decodeEntities drops code points that are not text", () => {
  assert.equal(decodeEntities("a&#1;b"), "a b");
  assert.equal(decodeEntities("a&#xD800;b"), "a b");
});

test("htmlToText strips tags before decoding, so escaped markup stays inert", () => {
  // The tag-stripper has already finished by the time &lt;script&gt; becomes
  // literal text, so nothing here can be parsed as an element.
  assert.equal(
    htmlToText("<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>"),
    "<script>alert(1)</script>",
  );
});

test("htmlToText strips tags and drops script and style bodies", () => {
  assert.equal(
    htmlToText("<p>Hello <b>world</b></p><script>evil()</script>"),
    "Hello world",
  );
  assert.equal(
    htmlToText("<style>.a{color:red}</style><div>Copy</div>"),
    "Copy",
  );
});

test("htmlToText keeps word boundaries across block tags", () => {
  // Without the closing-tag substitution these run together as "OneTwo".
  assert.equal(htmlToText("<p>One</p><p>Two</p>"), "One Two");
  assert.equal(htmlToText("One<br>Two"), "One Two");
});

// ── Regressions found in a live feed, 2026-08-06 ─────────────────────────────

test("zero-width joiners decode instead of printing literally", () => {
    // A ZWJ is what holds a Devanagari conjunct together, so Nepali CMSes emit
    // it mid-word. Unmapped it survived the decoder — unknown names are
    // deliberately preserved so `AT&T` works — and printed as "&zwj;" inside
    // headlines from Nepal Khabar and Thaha Khabar.
    assert.equal(decodeEntities("पद्&zwj;मा"), "पद्‍मा");
    assert.equal(decodeEntities("नपुर्&zwj;याए"), "नपुर्‍याए");
    assert.equal(decodeEntities("a&zwnj;b"), "a‌b");
    assert.ok(!decodeEntities("पद्&zwj;मा").includes("&zwj;"));
});

test("escaped markup in an attribute does not survive as a tag", () => {
    // DC Nepal builds og:description from article HTML, so the meta attribute
    // holds `&lt;p&gt;…`. Decoding alone turns that into a real <p> and prints
    // it; the extractor now decodes and then strips, which is this order.
    const attribute = "&lt;p&gt;काठमाडौं। सशस्त्र प्रहरी&lt;/p&gt;";
    assert.equal(htmlToText(decodeEntities(attribute)), "काठमाडौं। सशस्त्र प्रहरी");
    assert.ok(!htmlToText(decodeEntities(attribute)).includes("<p>"));
});
