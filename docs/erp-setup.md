# Speed Rail — local setup

How to bring the ERP up locally for the first time. Once you've done this, every further slice just needs `npm run db:migrate` after a new generated migration lands.

## 1. Provision Neon

1. Sign in to [Neon](https://console.neon.tech) (free tier is enough for MVP).
2. Create a project: `back-bar`. Region: `eu-west` (London-ish).
3. Default branch is fine. Copy the **pooled** connection string (looks like `postgresql://user:pass@ep-xxx-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require`).
4. Add it to `.env.local`:
   ```
   DATABASE_URL=postgresql://...
   SPEED_RAIL_ENABLED=1
   NEXT_PUBLIC_SPEED_RAIL_ENABLED=1
   ```

> The two flag vars must match. The server-only `SPEED_RAIL_ENABLED` 404s the `/erp/*` routes when off; the public copy hides the **ERP** link in the top nav.

## 2. Apply the schema

```
npm run db:migrate
```

This creates `suppliers`, `components`, `component_price_history`, `system_settings`. Re-run anytime new migrations land — Drizzle tracks state.

If you want to skip a migration round-trip in dev (push schema directly without writing a migration file):
```
npm run db:push
```
Don't use `db:push` for production — always generate + migrate.

## 3. Seed

```
npm run db:seed
```

Inserts:
- 3 system settings (wastage 2%, labour £15/hr, next serial 35001).
- 20 components (10 ingredients, 5 dry goods, 5 packaging) from `seed/components.csv`.
- The **Drinks / Recipes layer** (`scripts/erp/seed-recipes.ts`):
  - 49 ingredient components total — the legacy buying-spreadsheet master
    migrated in (real prices), 11 net-new (placeholder prices), plus a £0 `Water`.
  - 3 clients (MFC default, F&M, Cripps), 25 drinks (Clementini archived).
  - 28 recipes (19 MFC, 7 F&M, 2 Cripps), percentage lines validated to sum 100.
  - 29 SKUs migrated from the legacy GTIN map, with `drink_id` wired.

Idempotent — re-running won't duplicate anything or bump recipe versions.

## 4. Run

```
npm run dev
```

Login with the existing site password, then click **ERP** in the top nav (or go to `/erp`).

Routes:
- `/erp` — module landing with counts.
- `/erp/suppliers` — list + new + edit.
- `/erp/components` — list grouped by type + new + edit, with price history per component.
- `/erp/settings` — the three system settings.

Drinks / Recipes / Calculator (these are top-nav pages, **not** flag-gated, but
they read from Postgres — see the cutover note below):
- `/drinks` — index of every drink, client-recipe badges, last-updated.
- `/drinks/[slug]` — client tabs (MFC first), current recipe lines, version
  history, "Edit" and "+ Add <client> recipe".
- `/drinks/[slug]/edit` / `/new` — recipe editor (versioned saves).
- `/calculator` — client → drink → litres → ingredient quantities + cost,
  reading the live recipe.

### Cutover note (important)

`/drinks` and `/calculator` now read recipes from Postgres — they no longer
carry any embedded recipe data. They degrade to a "set DATABASE_URL" notice when
no connection string is present, so a deploy without Neon won't white-screen, but
they are non-functional until the DB is provisioned, migrated, and seeded. Per
the brief, ship the calculator cutover **last**, once the tables are populated
and trusted. `DATABASE_URL` must be set in the production env before merging.

### Open items to confirm (from the brief, before go-live)

- **F&M Vesper percentages** — renormalised to Gin 60.6 / Vodka 10.1 / Lillet
  10.1 / Cocchi Americano 10.1 / Water 9.1 (preserves the 6:1:1:1 spirit base).
  The spreadsheet used pre-water percentages, which is mathematically ambiguous —
  confirm the exact figures.
- **Placeholder prices** on the 11 net-new components (Scratch, Espresso, 1:1
  Sugar Syrup, Mozart, Jerez, Black Bottle, Apple Juice, Oat Milk, Shipwreck,
  Fernet, Maple Syrup) and Water (£0). Correct them via the price-history page as
  real invoices arrive.
- **Recipe count** — the brief header says "29 recipes across 27 drinks"; its
  tables enumerate 28 recipes across 25 drinks, which is what's seeded. Worth a
  reconcile if two are genuinely missing.

## 5. Vercel

When ready to enable the ERP in production:
1. Set `DATABASE_URL`, `SPEED_RAIL_ENABLED=1`, `NEXT_PUBLIC_SPEED_RAIL_ENABLED=1` in Vercel → Settings → Environment Variables.
2. Deploy. The migration runs locally — Vercel itself doesn't need DB write access (Neon's branchable URLs make schema rollouts straightforward).

For staging, create a Neon **branch** off main and set its connection string in Vercel preview env. That way every PR can dogfood against an isolated DB.

## Future slices

Adding tables (slice 2 inbounds, slice 3 recipes, etc.) is:
1. Edit `src/db/schema.ts`.
2. `npm run db:generate --name=slice_X_<topic>`.
3. Review the generated SQL in `drizzle/`.
4. `npm run db:migrate`.

Migrations are committed with each PR.
