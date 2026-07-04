# Slice 1.1 — Completion Report

**Branch:** `speed-rail/slice-1-1` · **Draft PR:** _(link below once pushed)_
**Date:** 2026-07-04
**Scope:** UOM foundation on Component (blocks Slice 2) + four Slice 1 dogfood polish items.

Build is clean (`npm run build` ✓, `npm run typecheck` ✓). All five deliverables verified against the running dev server on :3000 and a production build on :3001.

---

## What shipped

### 1. UOM foundation on Component  (BLOCKING for Slice 2)
Per the reality check, the columns already carried purchase-UOM semantics, so this was **new enum + backfill + UI**, not a rename.

- **Schema** (`src/db/schema.ts`): new `purchase_uom` enum (`bottle | case | pouch | roll | bag | each`) + nullable `purchase_uom` / `purchase_label` columns. Kept `pack_size` / `pack_cost` and documented the spec-name mapping in a comment (`pack_size ≡ purchase_size`, `pack_cost ≡ £ per purchase_uom`). `reorder_threshold` / `reorder_quantity` reinterpreted as purchase-UOM values (labels only; data was empty).
- **Migrations** (`drizzle/`):
  - **A — `0004_slice_1_1_purchase_uom.sql`** — adds enum + two nullable columns. Online-safe (nullable `ADD COLUMN`, no table rewrite, no long lock). **APPLIED.**
  - **B — `0005_slice_1_1_backfill_purchase_uom.sql`** — data backfill for all live components. **APPLIED.**
  - **C — `0006_slice_1_1_purchase_uom_not_null.sql`** — `SET NOT NULL`. **NOT APPLIED — runs at deploy** (see "Deploy note").
  - `scripts/erp/apply-sql.ts` — transactional, idempotent applier (used for A+B; use it for C at deploy).
- **Shared helper** (`src/lib/uom.ts`) — `derivePurchaseLabel`, `costPerConsumptionUom`, `formatDerivedUnitCost`, and the dual-UOM `formatStockDual` stub ("8,400 ml ≈ 12 bottles") that Slice 2 Inbounds/stock surfaces can use on day one.
- **Component UI** — edit form: purchase-unit dropdown + optional label override; cost field reads "Unit cost (£ per {purchase_uom})" with a live derived per-consumption figure; reorder fields relabelled. List: purchase label + £/purchase-unit + muted derived per-uom. Detail: current-cost header (both UOMs) + price-history rows headlined per purchase-UOM with the per-consumption cost muted alongside.
- **Seed** (`seed/components.csv` + loader) rebuilt to carry `purchase_uom` / `purchase_label` going forward.

**Backfill result (62 live components, 0 left null):** `bottle: 50 · bag: 2 · each: 10`.
- Citrus juices (Lemons, Limes) → `bag`, label "per litre juiced".
- All dry goods / packaging (each-UOM) → `each` (labels stay `each`, not `roll`).
- All other ml ingredients → `bottle`.
- Hand-corrected rows 31 (Antica), 36 (Aperol), 62 (Gin Amalthea) received `purchase_uom = bottle` only; **their pack_size / pack_cost / prices were not touched** (verified: Antica 1000ml @ £24.70, Aperol 700ml @ £13.10, Amalthea 1000ml @ £16.67).

### 2. Active/Inactive filter on Suppliers  (pattern-establisher)
Reusable, URL-driven segmented control (`StatusFilter` + shared `parseStatus` in a non-client module). Default **Active**, plus Inactive / All. Top-right beside "New supplier". Drops onto Components/Inbounds/Customers/Recipes later with no redesign.

### 3. Per-setting audit timestamps  (BUG fix)
`system_settings` was already one row per setting. Fix is in the write path: only stamp `updated_at` on settings whose value **actually changed** — the old code upserted all three every save, resetting all three "updated" labels. The audit trail no longer lies.

### 4. Save confirmation toast  (SYSTEMIC)
Global `ToastHost` mounted in the ERP layout; server actions signal via a URL flash param. Success = green, 3s auto-dismiss, click-to-dismiss; error = red, sticky, surfaces the server message. Retrofitted onto supplier create/edit/activate/deactivate, component create/edit (incl. price-history mutations), and settings save. Every Slice 2–7 form inherits it via `withFlash()`.

### 5. Layout-aware /erp disabled page  (UX fix)
Flag off no longer throws `notFound()` (which dropped the user onto the bare Next 404 outside the shell). Now a reusable `<ModuleDisabled>` renders **inside** the Back Bar shell — nav intact, copy says "disabled" (intentional), not "404" (broken). Reusable for any future flag-disabled module.

---

## What to dogfood

1. **Components list & edit** — open a few components, check the purchase label reads right (e.g. "Gin (in-house) · bottle (1000ml) · £22.50/bottle · ≈ £0.0225/ml"). Edit a spirit, change the purchase unit / label, confirm the derived per-ml figure updates live and a green toast fires on save.
2. **Price history** — edit a component's cost; confirm the new history row reads per-bottle with the per-ml cost muted underneath.
3. **Suppliers filter** — toggle Active / Inactive / All; confirm the default is Active and the URL updates.
4. **Settings timestamps** — change ONE setting, save; confirm only that field's "updated" date moves.
5. **Save toasts** — create/deactivate a supplier, save settings; watch for the green confirmation. Trigger a validation error (blank required field) to see the red sticky toast.
6. **Disabled page** — (optional) blank `SPEED_RAIL_ENABLED`, hit `/erp`; you should stay in the Back Bar shell on a "module disabled" page, not a bare 404.

---

## Flagged for Cyrus

- **`bottle` defaulted onto bulk / house liquids.** The backfill rule "ml ingredient → bottle" is mechanical; these ten are almost certainly *not* literally bought as bottles, but `bottle` is the least-wrong of the six enum values today. Please confirm or re-assign when convenient (a `pouch`/`bag`/other may fit some):
  `10 Sours base · 23 Coffee · 27 Monin Grenadine · 33 Agave Syrup · 51 Espresso · 52 1:1 Sugar Syrup · 56 Apple Juice · 57 Oat Milk · 60 Maple Syrup · 61 Water`
  (Sours base → bottle was explicitly per your checklist, until it's promoted to a sub-recipe in v1.5.)
- **Live count was 62, not 61** — the extra row is `62 Gin (Amalthea)`, one of the hand-corrected "do not modify" rows. Handled cleanly (purchase_uom only). No action needed.
- **Placeholder prices** (Matthew Clark et al.) untouched — that's your operational pass, not this slice.

## Deploy note (Migration C)

Migration C (`0006_..._not_null.sql`) is **written but deliberately not applied** — the Neon DB is shared with production and the older prod code inserts components without `purchase_uom`. Run it at deploy, *after* this code (which always writes purchase_uom) is live:

```
npx tsx --env-file=.env.local scripts/erp/apply-sql.ts drizzle/0006_slice_1_1_purchase_uom_not_null.sql
```

Then flip `purchaseUom` to `.notNull()` in `src/db/schema.ts` (comment marks the spot) and add a journal entry so drizzle-kit stays consistent. Precondition already met: Migration B left zero nulls.

## Notes / caveats

- The dev server in tmux `speedrail` was left running (hot-reloaded these changes); not touched.
- `package-lock.json` had an unrelated pre-existing modification at session start — left out of these commits.
- Price-history rows store the derived per-consumption cost; the detail page reconstructs the per-purchase headline from the component's *current* pack_size. Exact whenever pack_size is unchanged (the common case). Slice 2 Inbounds will write per-purchase cost into history directly per spec §5.8.
