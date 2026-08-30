ALTER TABLE "skus" ADD COLUMN "declared_abv" numeric(4, 1);--> statement-breakpoint
ALTER TABLE "skus" ADD COLUMN "declared_abv_source" text;--> statement-breakpoint
ALTER TABLE "skus" ADD COLUMN "declared_abv_noted" date;