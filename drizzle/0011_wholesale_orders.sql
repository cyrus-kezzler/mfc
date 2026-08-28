CREATE TYPE "public"."purchase_commitment_status" AS ENUM('placed', 'arrived', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."wholesale_order_status" AS ENUM('received', 'acknowledged', 'priced', 'committed', 'in_production', 'dispatched', 'invoiced', 'closed');--> statement-breakpoint
CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"quickbooks_customer_id" text,
	"account_code" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_commitments" (
	"id" serial PRIMARY KEY NOT NULL,
	"supplier_name" text NOT NULL,
	"component_id" integer,
	"description" text,
	"qty" numeric(12, 3) NOT NULL,
	"uom" text,
	"unit_price" numeric(12, 4),
	"total_price" numeric(12, 2),
	"ordered_on" date NOT NULL,
	"expected_on" date,
	"wholesale_order_id" integer,
	"reference" text,
	"status" "purchase_commitment_status" DEFAULT 'placed' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wholesale_order_bookings" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"booked_for" timestamp with time zone,
	"reference" text,
	"haulier" text,
	"cases" integer,
	"pallets" integer,
	"booked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"booked_by" text,
	"is_current" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wholesale_order_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"line_no" integer,
	"customer_item_code" text,
	"customer_description" text,
	"sku_id" integer,
	"qty" numeric(12, 2) NOT NULL,
	"unit_description" text,
	"units_per_case" integer,
	"unit_price_stated" numeric(12, 4),
	"unit_price_quoted" numeric(12, 4),
	"quoted_on" date
);
--> statement-breakpoint
CREATE TABLE "wholesale_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"order_number" text NOT NULL,
	"raised_on" date,
	"received_at" timestamp with time zone,
	"source_thread_id" text,
	"document_ref" text,
	"status" "wholesale_order_status" DEFAULT 'received' NOT NULL,
	"requested_delivery_from" date,
	"requested_delivery_to" date,
	"booking_deadline" timestamp with time zone,
	"delivery_address" text,
	"booking_channel" text,
	"customer_supplied_components_due" date,
	"customer_rrp" numeric(12, 2),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "purchase_commitments" ADD CONSTRAINT "purchase_commitments_component_id_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."components"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_commitments" ADD CONSTRAINT "purchase_commitments_wholesale_order_id_wholesale_orders_id_fk" FOREIGN KEY ("wholesale_order_id") REFERENCES "public"."wholesale_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wholesale_order_bookings" ADD CONSTRAINT "wholesale_order_bookings_order_id_wholesale_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."wholesale_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wholesale_order_lines" ADD CONSTRAINT "wholesale_order_lines_order_id_wholesale_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."wholesale_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wholesale_order_lines" ADD CONSTRAINT "wholesale_order_lines_sku_id_skus_id_fk" FOREIGN KEY ("sku_id") REFERENCES "public"."skus"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wholesale_orders" ADD CONSTRAINT "wholesale_orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "purchase_commitments_wholesale_order_idx" ON "purchase_commitments" USING btree ("wholesale_order_id");--> statement-breakpoint
CREATE INDEX "purchase_commitments_status_idx" ON "purchase_commitments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "wholesale_order_bookings_order_current_idx" ON "wholesale_order_bookings" USING btree ("order_id") WHERE "wholesale_order_bookings"."is_current";--> statement-breakpoint
CREATE INDEX "wholesale_order_lines_order_idx" ON "wholesale_order_lines" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "wholesale_orders_status_idx" ON "wholesale_orders" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "wholesale_orders_customer_order_uq" ON "wholesale_orders" USING btree ("customer_id","order_number");