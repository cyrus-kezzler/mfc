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

// ─── Inferred types ─────────────────────────────────────────────────────────

export type Supplier = typeof suppliers.$inferSelect;
export type NewSupplier = typeof suppliers.$inferInsert;

export type Component = typeof components.$inferSelect;
export type NewComponent = typeof components.$inferInsert;

export type ComponentPriceHistoryRow = typeof componentPriceHistory.$inferSelect;
export type NewComponentPriceHistoryRow = typeof componentPriceHistory.$inferInsert;

export type SystemSetting = typeof systemSettings.$inferSelect;
export type NewSystemSetting = typeof systemSettings.$inferInsert;

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
