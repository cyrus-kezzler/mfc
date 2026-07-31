CREATE TYPE "public"."sku_component_role" AS ENUM('bottle', 'closure', 'front_label', 'hygiene_label', 'epr', 'outer_carton', 'shipping');--> statement-breakpoint
CREATE TABLE "sku_components" (
	"id" serial PRIMARY KEY NOT NULL,
	"sku_id" integer NOT NULL,
	"component_id" integer NOT NULL,
	"quantity" numeric(12, 4) DEFAULT '1' NOT NULL,
	"role" "sku_component_role" NOT NULL,
	"include_in_cogs" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sku_components_qty_positive" CHECK ("sku_components"."quantity" > 0)
);
--> statement-breakpoint
ALTER TABLE "skus" ADD COLUMN "client_id" integer;--> statement-breakpoint
ALTER TABLE "sku_components" ADD CONSTRAINT "sku_components_sku_id_skus_id_fk" FOREIGN KEY ("sku_id") REFERENCES "public"."skus"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sku_components" ADD CONSTRAINT "sku_components_component_id_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."components"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sku_components_sku_idx" ON "sku_components" USING btree ("sku_id");--> statement-breakpoint
CREATE INDEX "sku_components_component_idx" ON "sku_components" USING btree ("component_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sku_components_sku_component_uq" ON "sku_components" USING btree ("sku_id","component_id");--> statement-breakpoint
ALTER TABLE "skus" ADD CONSTRAINT "skus_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "skus_client_idx" ON "skus" USING btree ("client_id");