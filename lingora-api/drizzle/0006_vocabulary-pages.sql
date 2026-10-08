CREATE TABLE "vocabulary_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"language_id" uuid NOT NULL,
	"slug" varchar(160) NOT NULL,
	"title" varchar(200) NOT NULL,
	"heading" varchar(200) NOT NULL,
	"translation_code" varchar(16) DEFAULT 'th' NOT NULL,
	"category" varchar(120) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"background_url" text DEFAULT '' NOT NULL,
	"aspect_ratio" double precision DEFAULT 1.5 NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "vocabulary_pages_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "vocabulary_pages" ADD CONSTRAINT "vocabulary_pages_language_id_languages_id_fk" FOREIGN KEY ("language_id") REFERENCES "public"."languages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocabulary_pages" ADD CONSTRAINT "vocabulary_pages_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;