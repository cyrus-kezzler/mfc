-- Slice 1.1 · Migration A — UOM foundation, additive & online-safe.
-- Adds the purchase_uom enum and two NULLABLE columns to components. A nullable
-- ADD COLUMN with no default is a metadata-only change in Postgres (no table
-- rewrite, no long lock), so it is safe to apply against the shared prod DB while
-- the older production code is still running — that code simply ignores the new
-- columns. Migration B (0005) backfills; Migration C (0006) tightens to NOT NULL.
-- Guarded so a re-apply is a harmless no-op.
DO $$ BEGIN
  CREATE TYPE "public"."purchase_uom" AS ENUM('bottle', 'case', 'pouch', 'roll', 'bag', 'each');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TABLE "components" ADD COLUMN IF NOT EXISTS "purchase_uom" "purchase_uom";--> statement-breakpoint
ALTER TABLE "components" ADD COLUMN IF NOT EXISTS "purchase_label" text;
