/**
 * Speed Rail (Back Bar ERP) Postgres schema — Drizzle.
 *
 * Spec source: docs/erp-spec.md §5. Field lists are illustrative per the spec —
 * we inline ingredient-specific columns on `components` rather than splitting
 * IngredientDetails out into its own table for slice 1. We can extract later if
 * the column count balloons.
 *
 * Slice 1 (Foundations): suppliers, components, component_price_history, system_settings.
 * Later slices add: inventory_lots, inbounds, inbound_lines, recipes, recipe_lines,
 * products, production_runs, production_run_consumption, production_run_outputs,
 * bottle_serials, customers, pricing_tiers, price_lists, price_list_lines.
 */

import { sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  serial,
  text,
  numeric,
  integer,
  boolean,
  timestamp,
  date,
  jsonb,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";

// ─── Enums ──────────────────────────────────────────────────────────────────

export const componentTypeEnum = pgEnum("component_type", [
  "ingredient",
  "sub_recipe",
  "dry_good",
  "packaging",
]);

export const uomEnum = pgEnum("uom", ["ml", "g", "each", "m"]);

export const priceSourceEnum = pgEnum("price_source", ["inbound", "manual"]);

/**
 * What job a component does on a SKU's bill of materials.
 *
 * The first five are PRIMARY packaging: they are on every bottle no matter how
 * it ships, so they belong inside COGS (Cyrus's ruling, 30 Jul 2026). The last
 * two are SECONDARY, they vary by channel, and they belong in the Channel P&L.
 * The `include_in_cogs` flag on the row is what actually decides; this enum is
 * for reporting and for catching a row filed under the wrong job.
 */
export const skuComponentRoleEnum = pgEnum("sku_component_role", [
  "bottle",
  "closure",
  "front_label",
  "back_label",
  "hygiene_label",
  "epr",
  "outer_carton",
  "shipping",
]);

// ─── Suppliers — spec §5.1 ──────────────────────────────────────────────────

export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  address: text("address"),
  paymentTerms: text("payment_terms"),
  defaultCurrency: text("default_currency").notNull().default("GBP"),
  notes: text("notes"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Components — spec §5.2 ─────────────────────────────────────────────────

export const components = pgTable(
  "components",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    type: componentTypeEnum("type").notNull(),
    uom: uomEnum("uom").notNull(),

    defaultSupplierId: integer("default_supplier_id").references(
      () => suppliers.id,
      { onDelete: "set null" },
    ),

    /**
     * Operator entry: how the supplier sells it.
     * e.g. a 700ml bottle of Cocchi Torino: pack_size = 700, pack_cost = 15.17 (in UOM units).
     * For each-/m-UOM components pack_size is typically 1.
     */
    packSize: numeric("pack_size", { precision: 12, scale: 3 }),
    packCost: numeric("pack_cost", { precision: 12, scale: 2 }),

    /**
     * Derived: pack_cost / pack_size, in £ per UOM. Cached for fast recipe rollup.
     * Recipes consume in UOM units, so this is the canonical figure for cost engine.
     */
    unitCost: numeric("unit_cost", { precision: 12, scale: 4 }).notNull().default("0"),
    /** When the cached unitCost was last set. */
    unitCostSetAt: timestamp("unit_cost_set_at", { withTimezone: true }),

    reorderThreshold: numeric("reorder_threshold", { precision: 12, scale: 3 }),
    reorderQuantity: numeric("reorder_quantity", { precision: 12, scale: 3 }),
    leadTimeDays: integer("lead_time_days"),
    storageLocation: text("storage_location"),
    notes: text("notes"),

    // Ingredient-only fields (nullable for other types). Per spec §5.2 these
    // could live in an IngredientDetails table; inlining for now.
    abv: numeric("abv", { precision: 5, scale: 2 }),
    allergenFlags: jsonb("allergen_flags"),
    shelfLifeDays: integer("shelf_life_days"),

    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("components_type_idx").on(t.type),
    index("components_active_idx").on(t.active),
    index("components_default_supplier_idx").on(t.defaultSupplierId),
  ],
);

// ─── Component price history — spec §5.3 ────────────────────────────────────

export const componentPriceHistory = pgTable(
  "component_price_history",
  {
    id: serial("id").primaryKey(),
    componentId: integer("component_id")
      .notNull()
      .references(() => components.id, { onDelete: "cascade" }),
    supplierId: integer("supplier_id").references(() => suppliers.id, {
      onDelete: "set null",
    }),
    unitCost: numeric("unit_cost", { precision: 12, scale: 4 }).notNull(),
    currency: text("currency").notNull().default("GBP"),
    uom: uomEnum("uom").notNull(),
    effectiveDate: date("effective_date").notNull(),
    source: priceSourceEnum("source").notNull(),
    /** For inbound-sourced rows, the inbound id; null for manual entries. */
    sourceId: text("source_id"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("component_price_history_component_idx").on(t.componentId),
    index("component_price_history_effective_date_idx").on(t.effectiveDate),
  ],
);

// ─── System settings — key/value ────────────────────────────────────────────
// Spec §10 + §13 #2/#4: wastage_pct, labour_rate, plus the global serial counter
// for the bottle-serial spine.

export const systemSettings = pgTable("system_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Drinks / Recipes layer ─────────────────────────────────────────────────
// Source: "Drinks, Recipes, and the Calculator rebuild" brief (2026-06-02).
// Lifts recipe knowledge out of the calculator into a first-class Drink with
// one client-scoped Recipe beneath it. Recipes are versioned and percentage-
// based (proportions, scaled to any batch size by the calculator).
//
// Note on PK style: the brief specifies UUID PKs, but the Slice 1 foundation
// uses serial integers throughout — we match the foundation so FKs into
// `components` (and everywhere else) stay consistent.

export const drinkStatusEnum = pgEnum("drink_status", ["active", "archived"]);

/** Clients a recipe can be scoped to. Exactly three seeded: mfc, fm, cripps. */
export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  /** true for MFC only — the default recipe a new client recipe is cloned from. */
  isDefault: boolean("is_default").notNull().default(false),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** A cocktail. Just slug + name + status for now (garnish/glassware come later). */
export const drinks = pgTable("drinks", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  status: drinkStatusEnum("status").notNull().default("active"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * A versioned, client-scoped recipe for a drink. Editing creates a new row
 * (version + 1, is_current = true) and flips the old row's is_current to false;
 * past versions and their lines are immutable history, so a re-price of a past
 * batch always finds the same lines.
 */
export const recipes = pgTable(
  "recipes",
  {
    id: serial("id").primaryKey(),
    drinkId: integer("drink_id")
      .notNull()
      .references(() => drinks.id, { onDelete: "cascade" }),
    clientId: integer("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    version: integer("version").notNull().default(1),
    isCurrent: boolean("is_current").notNull().default(true),
    // Free-text production method/instructions (e.g. infusions, filtering).
    // Versioned with the rest of the recipe — each edit carries it forward.
    method: text("method"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("recipes_drink_client_idx").on(t.drinkId, t.clientId),
    uniqueIndex("recipes_drink_client_version_uq").on(t.drinkId, t.clientId, t.version),
    // Exactly one current row per (drink, client).
    uniqueIndex("recipes_current_uq")
      .on(t.drinkId, t.clientId)
      .where(sql`${t.isCurrent}`),
  ],
);

/**
 * One ingredient line of a recipe, by percentage of the batch. Per-line CHECK
 * keeps each share in [0, 100]; the stricter "lines sum to exactly 100" rule is
 * a cross-row aggregate (not expressible as a row-level CHECK) and is enforced
 * in the seed and the edit server action.
 */
export const recipeLines = pgTable(
  "recipe_lines",
  {
    id: serial("id").primaryKey(),
    recipeId: integer("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    componentId: integer("component_id")
      .notNull()
      .references(() => components.id, { onDelete: "restrict" }),
    percentage: numeric("percentage", { precision: 6, scale: 3 }).notNull(),
    displayOrder: integer("display_order").notNull().default(0),
  },
  (t) => [
    index("recipe_lines_recipe_idx").on(t.recipeId),
    check("recipe_lines_pct_range", sql`${t.percentage} >= 0 AND ${t.percentage} <= 100`),
  ],
);

/**
 * Sellable bottle formats (e.g. negroni-250, negroni-500), migrated from the
 * legacy per-drink GTIN map. `drink_id` is the §8 FK (nullable for sets like
 * Martini Flight that aren't a single drink). The calculator reads sizeMl to
 * show per-bottle cost at each available size. COGS-from-recipe is a follow-up;
 * the FK is wired but not yet read for costing.
 */
export const skus = pgTable(
  "skus",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull().unique(),
    drinkId: integer("drink_id").references(() => drinks.id, { onDelete: "set null" }),
    /**
     * Which client's recipe this format sells under. Added 30 Jul 2026.
     *
     * Without it the table cannot express "Cripps Espresso Martini 700ml":
     * drink 6 carries both an own-brand recipe and a Cripps recipe, so
     * (drink_id, size_ml) is ambiguous the moment a partner shares a drink
     * name with the own-brand range. That ambiguity is why the flagship, about
     * half of all wholesale, had no SKU and had to be costed by hand.
     *
     * Nullable for now so the migration is purely additive. The 29 pre-existing
     * rows are all own-brand and are backfilled to Myatt's Fields by a separate
     * data step, after which this should be tightened to NOT NULL.
     */
    clientId: integer("client_id").references(() => clients.id, { onDelete: "restrict" }),
    sizeMl: integer("size_ml").notNull(),
    gtin: text("gtin"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("skus_drink_idx").on(t.drinkId),
    index("skus_client_idx").on(t.clientId),
  ],
);

/**
 * Bill of materials: which dry goods and packaging go on a given SKU, and how
 * many of each. Added 30 Jul 2026 to close the gap the 20 Jul reconciliation
 * found, that no table linked any dry good to any SKU, so packaging cost could
 * never roll up and the honest build had to be assembled by hand.
 *
 * `include_in_cogs` is the mechanism for Cyrus's 30 Jul ruling: primary
 * packaging (bottle, closure, front label, hygiene label, EPR) sits inside
 * COGS because it is on every bottle regardless of channel; mailers, cases and
 * carriage sit outside it, in the Channel P&L, because they genuinely vary.
 */
export const skuComponents = pgTable(
  "sku_components",
  {
    id: serial("id").primaryKey(),
    skuId: integer("sku_id")
      .notNull()
      .references(() => skus.id, { onDelete: "cascade" }),
    componentId: integer("component_id")
      .notNull()
      .references(() => components.id, { onDelete: "restrict" }),
    /** How many of this component per finished bottle. Usually 1. */
    quantity: numeric("quantity", { precision: 12, scale: 4 }).notNull().default("1"),
    role: skuComponentRoleEnum("role").notNull(),
    includeInCogs: boolean("include_in_cogs").notNull().default(true),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("sku_components_sku_idx").on(t.skuId),
    index("sku_components_component_idx").on(t.componentId),
    uniqueIndex("sku_components_sku_component_uq").on(t.skuId, t.componentId),
    check("sku_components_qty_positive", sql`${t.quantity} > 0`),
  ],
);

// ─── Inferred types ─────────────────────────────────────────────────────────

export type Supplier = typeof suppliers.$inferSelect;
export type NewSupplier = typeof suppliers.$inferInsert;

export type Component = typeof components.$inferSelect;
export type NewComponent = typeof components.$inferInsert;

export type ComponentPriceHistoryRow = typeof componentPriceHistory.$inferSelect;
export type NewComponentPriceHistoryRow = typeof componentPriceHistory.$inferInsert;

export type SystemSetting = typeof systemSettings.$inferSelect;
export type NewSystemSetting = typeof systemSettings.$inferInsert;

export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;

export type Drink = typeof drinks.$inferSelect;
export type NewDrink = typeof drinks.$inferInsert;

export type Recipe = typeof recipes.$inferSelect;
export type NewRecipe = typeof recipes.$inferInsert;

export type RecipeLine = typeof recipeLines.$inferSelect;
export type NewRecipeLine = typeof recipeLines.$inferInsert;

export type Sku = typeof skus.$inferSelect;
export type NewSku = typeof skus.$inferInsert;

export type SkuComponent = typeof skuComponents.$inferSelect;
export type NewSkuComponent = typeof skuComponents.$inferInsert;

// ─── Setting keys ───────────────────────────────────────────────────────────

export const SETTING_KEYS = {
  /** Global wastage percentage applied to every recipe rollup. Stored as decimal string, e.g. "0.02". */
  WASTAGE_PCT: "wastage_pct",
  /** Single global labour rate in GBP per hour. Stored as decimal string, e.g. "15.00". */
  LABOUR_RATE_GBP_PER_HOUR: "labour_rate_gbp_per_hour",
  /** Next bottle-serial suffix to issue. Global counter. Stored as integer string, e.g. "35001". */
  NEXT_SERIAL_NUMBER: "next_serial_number",
} as const;

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];
