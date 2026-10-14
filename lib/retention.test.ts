import { strict as assert } from "node:assert";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

/**
 * The archive is permanent, and this is what keeps it that way.
 *
 * Nothing deletes an article: the writer is an INSERT … ON CONFLICT DO UPDATE,
 * so a story seen again updates in place and a story seen once stays. That is a
 * decision — the Supabase schema this replaced shipped
 * delete_articles_older_than(730) and prune_article_bodies(180), and both were
 * dropped rather than carried over.
 *
 * A decision held only by everyone remembering it is not held at all. Deleting
 * old rows is the obvious thing to reach for the first time disk looks tight,
 * and the cost of being wrong is asymmetric: the archive is enrichment already
 * paid for in model tokens, and a deleted row cannot be re-earned from a feed
 * that has moved on. So the rule is asserted here, and anyone who genuinely
 * wants retention has to delete this test and say why in the diff.
 *
 * It is also affordable, which is the fact that makes the rule easy to keep.
 * Measured on the live table: 5,302 bytes a row including indexes, against
 * about 161 new stories a day — roughly 0.3 GB a year, and 144 years of the
 * disk this runs on.
 */

const LIB = join(process.cwd(), "lib");
const DB_SCHEMA = join(process.cwd(), "db", "schema.sql");

/**
 * Statements that remove rows.
 *
 * Matched case-sensitively, in upper case, because every SQL keyword in this
 * codebase is written that way and ordinary English is not. The first draft
 * matched case-insensitively and failed on lib/utils.ts, which exports a string
 * helper called `truncate` — a test that cries wolf over a perfectly good
 * function is a test someone deletes.
 */
const DESTRUCTIVE = /\bDELETE\s+FROM\b|\bTRUNCATE\s+(?:TABLE\s+)?[a-z_"]/;

function sourceFiles(): string[] {
  return readdirSync(LIB)
    .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
    .map((name) => join(LIB, name));
}

describe("the archive is never pruned", () => {
  it("no module issues SQL that removes rows", () => {
    const offenders: string[] = [];

    for (const file of sourceFiles()) {
      const source = readFileSync(file, "utf8");
      // Strip comments first: this very rule is described in prose in
      // article-store.ts, and a test that trips over its own documentation
      // teaches people to delete the test.
      const code = source
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");

      if (DESTRUCTIVE.test(code)) {
        offenders.push(file.replace(process.cwd() + "/", ""));
      }
    }

    assert.deepEqual(
      offenders,
      [],
      `these modules can remove rows: ${offenders.join(", ")}. ` +
        "The archive is permanent — see the comment at the top of this file.",
    );
  });

  it("the schema defines no function that deletes articles", () => {
    const schema = readFileSync(DB_SCHEMA, "utf8");
    const code = schema
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("--"))
      .join("\n");

    assert.ok(
      !DESTRUCTIVE.test(code),
      "db/schema.sql defines something that removes rows. The Supabase schema " +
        "shipped delete_articles_older_than and prune_article_bodies; they " +
        "were dropped deliberately and must not come back by accident.",
    );
  });

  it("the writer upserts rather than replaces", () => {
    const store = readFileSync(join(LIB, "article-store.ts"), "utf8");
    assert.match(
      store,
      /ON CONFLICT \(id\) DO UPDATE/,
      "the write must be an upsert; a delete-then-insert would lose every " +
        "enrichment column the incoming batch does not carry",
    );
  });
});
