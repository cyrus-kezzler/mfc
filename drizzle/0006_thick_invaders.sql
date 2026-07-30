CREATE TABLE "component_recipes" (
	"id" serial PRIMARY KEY NOT NULL,
	"parent_component_id" integer NOT NULL,
	"child_component_id" integer NOT NULL,
	"quantity" numeric(12, 4) NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "component_recipes_qty_positive" CHECK ("component_recipes"."quantity" > 0),
	CONSTRAINT "component_recipes_no_self_ref" CHECK ("component_recipes"."parent_component_id" <> "component_recipes"."child_component_id")
);
--> statement-breakpoint
ALTER TABLE "components" ADD COLUMN "batch_yield" numeric(12, 4);--> statement-breakpoint
ALTER TABLE "components" ADD COLUMN "batch_method" text;--> statement-breakpoint
ALTER TABLE "component_recipes" ADD CONSTRAINT "component_recipes_parent_component_id_components_id_fk" FOREIGN KEY ("parent_component_id") REFERENCES "public"."components"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "component_recipes" ADD CONSTRAINT "component_recipes_child_component_id_components_id_fk" FOREIGN KEY ("child_component_id") REFERENCES "public"."components"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "component_recipes_parent_idx" ON "component_recipes" USING btree ("parent_component_id");--> statement-breakpoint
CREATE INDEX "component_recipes_child_idx" ON "component_recipes" USING btree ("child_component_id");--> statement-breakpoint
CREATE UNIQUE INDEX "component_recipes_parent_child_uq" ON "component_recipes" USING btree ("parent_component_id","child_component_id");