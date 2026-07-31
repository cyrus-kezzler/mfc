CREATE TYPE "public"."sku_price_type" AS ENUM('wholesale', 'rrp');--> statement-breakpoint
CREATE TABLE "sku_prices" (
	"id" serial PRIMARY KEY NOT NULL,
	"sku_id" integer NOT NULL,
	"price_type" "sku_price_type" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"shipping" numeric(12, 4),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sku_prices_amount_positive" CHECK ("sku_prices"."amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "sku_prices" ADD CONSTRAINT "sku_prices_sku_id_skus_id_fk" FOREIGN KEY ("sku_id") REFERENCES "public"."skus"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sku_prices_sku_idx" ON "sku_prices" USING btree ("sku_id");--> statement-breakpoint
CREATE INDEX "sku_prices_type_idx" ON "sku_prices" USING btree ("price_type");--> statement-breakpoint
CREATE UNIQUE INDEX "sku_prices_current_uq" ON "sku_prices" USING btree ("sku_id","price_type") WHERE "sku_prices"."effective_to" is null;