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

Idempotent — re-running won't duplicate anything.

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
