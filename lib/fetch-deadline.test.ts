import assert from "node:assert/strict";
import test from "node:test";
import { createServer, type Server } from "node:http";

import { readWithDeadline } from "./fetch-deadline";

function serve(
  handler: Parameters<typeof createServer>[1],
): Promise<{ url: string; close: () => void }> {
  return new Promise((resolve) => {
    const server: Server = createServer(handler);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({
        url: `http://127.0.0.1:${port}/feed.xml`,
        close: () => server.close(),
      });
    });
  });
}

// The stage this guards awaits 23 of these together, so one unbounded source
// sets the cost of the whole pass. That is how RSS came to take 34s of a 15s
// budget while every fetch was nominally capped at 7.5s: the AbortSignal was
// the only thing enforcing it, and on Vercel's patched fetch it was not
// arriving.
test("a source that accepts the connection and never answers is bounded", async () => {
  const { url, close } = await serve(() => {
    // Deliberately no response, ever.
  });
  try {
    const budgetMs = 600;
    const started = Date.now();

    await assert.rejects(
      () => readWithDeadline(url, budgetMs),
      /Timed out after 600ms|aborted/i,
    );

    const elapsed = Date.now() - started;
    assert.ok(
      elapsed < budgetMs + 1200,
      `took ${elapsed}ms against a ${budgetMs}ms budget — the deadline is not enforced`,
    );
  } finally {
    close();
  }
});

test("a source that sends headers then stalls the body is bounded too", async () => {
  // The failure mode a header-only timeout misses: the origin answers promptly
  // and then dribbles, holding the fan-out open while looking healthy.
  const { url, close } = await serve((_req, res) => {
    res.writeHead(200, { "content-type": "application/rss+xml" });
    res.write("<?xml version=\"1.0\"?><rss><channel>");
    // never ends the response
  });
  try {
    const started = Date.now();
    await assert.rejects(() => readWithDeadline(url, 600));
    assert.ok(Date.now() - started < 1800, "body read was not bounded");
  } finally {
    close();
  }
});

test("a prompt source returns its body well inside the budget", async () => {
  const { url, close } = await serve((_req, res) => {
    res.writeHead(200, { "content-type": "application/rss+xml" });
    res.end("<rss>ok</rss>");
  });
  try {
    assert.equal(await readWithDeadline(url, 5000), "<rss>ok</rss>");
  } finally {
    close();
  }
});

test("a non-2xx response rejects rather than returning an error page as content", async () => {
  const { url, close } = await serve((_req, res) => {
    res.writeHead(503);
    res.end("upstream unavailable");
  });
  try {
    await assert.rejects(() => readWithDeadline(url, 5000), /HTTP 503/);
  } finally {
    close();
  }
});
