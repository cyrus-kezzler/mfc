/**
 * Apply raw SQL migration file(s) against DATABASE_URL, statement by statement.
 *
 *   npx tsx --env-file=.env.local scripts/erp/apply-sql.ts drizzle/0004_*.sql drizzle/0005_*.sql
 *
 * Splits on drizzle's `--> statement-breakpoint` markers and runs each statement
 * in order inside a single transaction (all-or-nothing). Used to apply the Slice
 * 1.1 UOM migrations A (0004) and B (0005) out of band, and — at deploy — the
 * held-back Migration C (0006). Every Slice 1.1 statement is idempotent, so a
 * re-run is a harmless no-op.
 */

import { readFileSync } from "node:fs";
import { Client } from "@neondatabase/serverless";

async function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error("Usage: apply-sql.ts <file.sql> [<file.sql> ...]");
    process.exit(1);
  }
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const client = new Client(url);
  await client.connect();
  try {
    await client.query("BEGIN");
    for (const file of files) {
      const raw = readFileSync(file, "utf8");
      const statements = raw
        .split("--> statement-breakpoint")
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !/^(--[^\n]*\s*)+$/.test(s)); // skip comment-only chunks
      console.log(`\n▸ ${file} — ${statements.length} statement(s)`);
      for (const stmt of statements) {
        const preview = stmt.replace(/\s+/g, " ").slice(0, 70);
        await client.query(stmt);
        console.log(`  ✓ ${preview}${stmt.length > 70 ? "…" : ""}`);
      }
    }
    await client.query("COMMIT");
    console.log("\n✓ Committed.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("\n✗ Rolled back:", err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
