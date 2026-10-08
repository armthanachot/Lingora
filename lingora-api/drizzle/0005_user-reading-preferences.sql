CREATE TABLE "user_reading_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"auto_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_reading_preferences" ADD CONSTRAINT "user_reading_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;