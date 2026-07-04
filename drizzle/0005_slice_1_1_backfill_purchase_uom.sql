-- Slice 1.1 · Migration B (data) — backfill purchase_uom for every component.
--
-- Operational data migration. Not part of the drizzle journal on purpose: it is
-- run once, out of band, alongside Migration A. Idempotent — every UPDATE is
-- guarded by `purchase_uom IS NULL`, so re-running only touches rows still blank.
--
-- Default rules (from the Slice 1.1 handoff, "Reality check against the live schema"):
--   * Lemons (juice) / Limes (juice) → bag, label "per litre juiced".
--   * each-UOM components (dry goods, packaging, labels) → each. Labels stay
--     `each` for now, NOT `roll` — revisit when we actually buy label rolls.
--   * All remaining ml-UOM ingredients with pack_size > 1 → bottle. This is the
--     mechanical default; bulk house liquids (water, espresso, syrups, house
--     juices, oat milk, sours base) fall here too — flagged for Cyrus to confirm,
--     see SLICE-1.1-REPORT.md. `bottle` is the least-wrong of the six enum values.
--
-- Note: this also sets purchase_uom on the hand-corrected rows (31 Carpano Antica,
-- 36 Aperol, 62 Gin (Amalthea)). That is additive — it writes a brand-new column
-- and never touches their corrected pack_size / pack_cost / price — so it respects
-- the "do not modify" caution while completing the NOT NULL precondition for C.

-- Citrus juices → bag.
UPDATE "components"
   SET "purchase_uom" = 'bag',
       "purchase_label" = COALESCE("purchase_label", 'per litre juiced')
 WHERE "purchase_uom" IS NULL
   AND lower("name") IN ('lemons (juice)', 'limes (juice)');--> statement-breakpoint

-- each-UOM components → each.
UPDATE "components"
   SET "purchase_uom" = 'each'
 WHERE "purchase_uom" IS NULL
   AND "uom" = 'each';--> statement-breakpoint

-- Remaining ml-UOM ingredients with a real pack size → bottle.
UPDATE "components"
   SET "purchase_uom" = 'bottle'
 WHERE "purchase_uom" IS NULL
   AND "uom" = 'ml'
   AND "pack_size" IS NOT NULL
   AND "pack_size" > 1;
