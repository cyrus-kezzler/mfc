CREATE TYPE "public"."serve_method" AS ENUM('freezer', 'ice_in_glass', 'shake');--> statement-breakpoint
ALTER TABLE "drinks" ADD COLUMN "serve_method" "serve_method";--> statement-breakpoint
ALTER TABLE "drinks" ADD COLUMN "serve_note" text;--> statement-breakpoint
ALTER TABLE "drinks" ADD COLUMN "glass" text;--> statement-breakpoint
ALTER TABLE "drinks" ADD COLUMN "garnish" text;--> statement-breakpoint
ALTER TABLE "drinks" ADD COLUMN "garnish_supplied" boolean;--> statement-breakpoint
ALTER TABLE "drinks" ADD COLUMN "garnish_supplied_note" text;--> statement-breakpoint
ALTER TABLE "drinks" ADD COLUMN "rest_weeks_confirmed" integer;--> statement-breakpoint
ALTER TABLE "drinks" ADD COLUMN "rest_confirmed_on" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "drinks" ADD COLUMN "label_variance_note" text;--> statement-breakpoint
ALTER TABLE "drinks" ADD COLUMN "origin_place" text;--> statement-breakpoint
ALTER TABLE "drinks" ADD COLUMN "origin_year" text;--> statement-breakpoint
ALTER TABLE "drinks" ADD COLUMN "origin_person" text;--> statement-breakpoint
ALTER TABLE "drinks" ADD COLUMN "ownable_truth" text;--> statement-breakpoint
ALTER TABLE "drinks" ADD COLUMN "never_say" text;--> statement-breakpoint
ALTER TABLE "drinks" ADD COLUMN "lede" text;--> statement-breakpoint
ALTER TABLE "drinks" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "drinks" ADD COLUMN "detailed_description" text;--> statement-breakpoint
ALTER TABLE "drinks" ADD COLUMN "shopify_handle" text;--> statement-breakpoint
ALTER TABLE "drinks" ADD COLUMN "choose_six_handle" text;