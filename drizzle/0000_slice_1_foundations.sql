CREATE TYPE "public"."component_type" AS ENUM('ingredient', 'sub_recipe', 'dry_good', 'packaging');--> statement-breakpoint
CREATE TYPE "public"."price_source" AS ENUM('inbound', 'manual');--> statement-breakpoint
CREATE TYPE "public"."uom" AS ENUM('ml', 'g', 'each', 'm');--> statement-breakpoint
CREATE TABLE "component_price_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"component_id" integer NOT NULL,
	"supplier_id" integer,
	"unit_cost" numeric(12, 4) NOT NULL,
	"currency" text DEFAULT 'GBP' NOT NULL,
	"uom" "uom" NOT NULL,
	"effective_date" date NOT NULL,
	"source" "price_source" NOT NULL,
	"source_id" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "components" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" "component_type" NOT NULL,
	"uom" "uom" NOT NULL,
	"default_supplier_id" integer,
	"unit_cost" numeric(12, 4) DEFAULT '0' NOT NULL,
	"unit_cost_set_at" timestamp with time zone,
	"reorder_threshold" numeric(12, 3),
	"reorder_quantity" numeric(12, 3),
	"lead_time_days" integer,
	"storage_location" text,
	"notes" text,
	"abv" numeric(5, 2),
	"allergen_flags" jsonb,
	"shelf_life_days" integer,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"contact_email" text,
	"contact_phone" text,
	"address" text,
	"payment_terms" text,
	"default_currency" text DEFAULT 'GBP' NOT NULL,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "component_price_history" ADD CONSTRAINT "component_price_history_component_id_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."components"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "component_price_history" ADD CONSTRAINT "component_price_history_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "components" ADD CONSTRAINT "components_default_supplier_id_suppliers_id_fk" FOREIGN KEY ("default_supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "component_price_history_component_idx" ON "component_price_history" USING btree ("component_id");--> statement-breakpoint
CREATE INDEX "component_price_history_effective_date_idx" ON "component_price_history" USING btree ("effective_date");--> statement-breakpoint
CREATE INDEX "components_type_idx" ON "components" USING btree ("type");--> statement-breakpoint
CREATE INDEX "components_active_idx" ON "components" USING btree ("active");--> statement-breakpoint
CREATE INDEX "components_default_supplier_idx" ON "components" USING btree ("default_supplier_id");