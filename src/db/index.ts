/**
 * Drizzle DB client backed by Neon serverless Postgres.
 *
 * Lazy-initialised so that `next build` and other no-DB tooling don't blow up
 * when DATABASE_URL is missing — the connection only fails (with a clear
 * message) when something actually tries to query.
 *
 * Use the `db` export everywhere (server actions, route handlers, server
 * components). The Neon HTTP driver is connectionless — no pool to manage.
 */

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";

import * as schema from "./schema";

type AppDb = NeonHttpDatabase<typeof schema>;

let _db: AppDb | null = null;

function getDb(): AppDb {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add it to .env.local (Neon connection string) or pull from Vercel.",
    );
  }
  const sql: NeonQueryFunction<false, false> = neon(url);
  _db = drizzle(sql, { schema });
  return _db;
}

export const db: AppDb = new Proxy({} as AppDb, {
  get(_target, prop, receiver) {
    const real = getDb();
    const value = Reflect.get(real, prop, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export type Db = AppDb;

export * as erpSchema from "./schema";
