-- Slice 1.1 · Migration C — tighten purchase_uom to NOT NULL.
--
-- ⚠️  DO NOT APPLY against the shared prod DB during Slice 1.1 development.
--     The Neon database is currently shared with production, and the older
--     production code inserts components WITHOUT a purchase_uom. Adding this
--     constraint now would break those inserts.
--
--     This runs AT DEPLOY, after the Slice 1.1 code (which always writes
--     purchase_uom) has replaced the old production code. At that point:
--       1. Run this file.
--       2. Flip `purchaseUom` to `.notNull()` in src/db/schema.ts and add a
--          journal entry so drizzle-kit stays consistent.
--
-- Precondition: Migration B (0005) has backfilled every row, so no NULLs remain.
-- Guarded set-not-null is naturally idempotent (re-running on a NOT NULL column
-- is a no-op that Postgres accepts).

ALTER TABLE "components" ALTER COLUMN "purchase_uom" SET NOT NULL;
