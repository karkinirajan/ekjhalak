import assert from "node:assert/strict";
import test from "node:test";

import {
  OPTIMIZABLE_IMAGE_HOSTS,
  isOptimizableImage,
  remoteImagePatterns,
} from "./image-hosts";

// Next.js caps images.remotePatterns at 50 and enforces it when the server
// boots, not when the project builds — a 53-entry list compiled cleanly and
// then refused to start. A green build is therefore not evidence here; this is.
test("the host list stays within the remotePatterns cap Next.js enforces", () => {
  assert.ok(
    remoteImagePatterns.length <= 50,
    `remotePatterns has ${remoteImagePatterns.length} entries; Next.js refuses to start above 50`,
  );
});

// Hosts measured serving photographs in a live feed. Each one that falls off
// this list is roughly a third of a megabyte shipped unresized to every reader
// who sees that story.
const OBSERVED_FEED_IMAGE_HOSTS = [
  "assets-cdn.kathmandupost.com",
  "www.onlinekhabar.com",
  "english.onlinekhabar.com",
  "npcdn.ratopati.com",
  "images.nagariknewscdn.com",
  "www.dcnepal.com",
  "bizmandu.com",
  "www.thahakhabar.com",
  "www.setopati.com",
  "risingnepaldaily.com",
  "c.ndtvimg.com",
  "static.dw.com",
  "ichef.bbci.co.uk",
  "s.france24.com",
  "i.guim.co.uk",
  "static01.nyt.com",
  "static.toiimg.com",
  "th-i.thgim.com",
  "cdn.i-scmp.com",
  "www.aljazeera.com",
  "www.thehindu.com",
  "www.politico.eu",
  "nepalkhabar.prixacdn.net",
];

test("every host observed serving feed images is optimizable", () => {
  for (const host of OBSERVED_FEED_IMAGE_HOSTS) {
    assert.equal(
      isOptimizableImage(`https://${host}/photo.jpg`),
      true,
      `${host} would be served raw`,
    );
  }
});

// The `**.` patterns are matched by suffix, so the leading dot is what stops a
// wildcard from matching a domain that merely ends in the trusted name.
test("a lookalike host does not satisfy a wildcard", () => {
  for (const host of [
    "notkathmandupost.com",
    "kathmandupost.com.attacker.example",
    "evil.example.com",
    "xratopati.com",
  ]) {
    assert.equal(
      isOptimizableImage(`https://${host}/photo.jpg`),
      false,
      `${host} was accepted`,
    );
  }
});

test("only https is optimizable", () => {
  assert.equal(isOptimizableImage("http://www.aljazeera.com/a.jpg"), false);
  assert.equal(isOptimizableImage("https://www.aljazeera.com/a.jpg"), true);
});

test("a non-URL falls back rather than throwing", () => {
  // The generated topic cover art is a data: URI and the feed can carry junk;
  // both belong on a plain <img> instead of blowing up the card.
  assert.equal(isOptimizableImage("/local/fallback.svg"), false);
  assert.equal(isOptimizableImage("data:image/svg+xml,%3Csvg/%3E"), false);
  assert.equal(isOptimizableImage(""), false);
});

test("every wildcard entry is well-formed", () => {
  for (const pattern of OPTIMIZABLE_IMAGE_HOSTS) {
    assert.ok(
      !pattern.startsWith("*") || pattern.startsWith("**."),
      `${pattern} is not a shape remotePatterns accepts`,
    );
    assert.ok(!pattern.includes("/"), `${pattern} should be a hostname only`);
  }
});
