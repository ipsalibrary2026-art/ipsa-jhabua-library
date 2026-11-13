CREATE TYPE "public"."book_copy_status" AS ENUM('available', 'issued');--> statement-breakpoint
CREATE TABLE "book_copies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"copy_code" text NOT NULL,
	"book_id" uuid NOT NULL,
	"shelf_number" text NOT NULL,
	"status" "book_copy_status" DEFAULT 'available' NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "book_copies_copy_code_unique" UNIQUE("copy_code")
);
--> statement-breakpoint
ALTER TABLE "issue_records" ADD COLUMN "copy_id" uuid;--> statement-breakpoint
ALTER TABLE "book_copies" ADD CONSTRAINT "book_copies_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "book_copies_book_idx" ON "book_copies" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "book_copies_status_idx" ON "book_copies" USING btree ("status");--> statement-breakpoint
ALTER TABLE "issue_records" ADD CONSTRAINT "issue_records_copy_id_book_copies_id_fk" FOREIGN KEY ("copy_id") REFERENCES "public"."book_copies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "issue_records_copy_idx" ON "issue_records" USING btree ("copy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "issue_records_active_copy_unique" ON "issue_records" USING btree ("copy_id") WHERE "issue_records"."status" = 'issued' and "issue_records"."copy_id" is not null;--> statement-breakpoint
-- Backfill one physical copy row for every existing copy implied by total_copies.
INSERT INTO "book_copies" ("copy_code", "book_id", "shelf_number", "status", "created_at", "updated_at")
SELECT
	CASE WHEN series.n = 1 THEN b."book_code" ELSE b."book_code" || '-C' || series.n END,
	b."id",
	b."shelf_number",
	'available',
	b."created_at",
	now()
FROM "books" b
CROSS JOIN LATERAL generate_series(1, GREATEST(b."total_copies", 1)) AS series(n);--> statement-breakpoint
-- Attach existing issue history to a distinct physical copy per record.
WITH numbered AS (
	SELECT "id", "book_id",
		row_number() OVER (
			PARTITION BY "book_id"
			ORDER BY CASE WHEN "status" = 'issued' THEN 0 ELSE 1 END, "created_at", "id"
		) AS rn
	FROM "issue_records"
), copies_numbered AS (
	SELECT "id" AS copy_id, "book_id",
		row_number() OVER (PARTITION BY "book_id" ORDER BY "copy_code") AS rn
	FROM "book_copies"
)
UPDATE "issue_records" ir
SET "copy_id" = cn.copy_id
FROM numbered n
JOIN copies_numbered cn ON cn."book_id" = n."book_id" AND cn.rn = n.rn
WHERE ir."id" = n."id";--> statement-breakpoint
-- Copies attached to an active loan are marked issued.
UPDATE "book_copies" bc
SET "status" = 'issued'
WHERE EXISTS (
	SELECT 1 FROM "issue_records" ir
	WHERE ir."copy_id" = bc."id" AND ir."status" = 'issued'
);
