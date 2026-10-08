CREATE TABLE "learner_block_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"block_id" uuid NOT NULL,
	"response" jsonb,
	"attempts" integer DEFAULT 0 NOT NULL,
	"score" double precision,
	"completed" boolean DEFAULT false NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "lesson_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid NOT NULL,
	"type" varchar(64) NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"content" jsonb NOT NULL,
	"settings" jsonb NOT NULL,
	"interaction" jsonb NOT NULL,
	"completion" jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "progress" ADD COLUMN "current_block_id" uuid;--> statement-breakpoint
ALTER TABLE "progress" ADD COLUMN "started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "learner_block_states" ADD CONSTRAINT "learner_block_states_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_block_states" ADD CONSTRAINT "learner_block_states_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learner_block_states" ADD CONSTRAINT "learner_block_states_block_id_lesson_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."lesson_blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_blocks" ADD CONSTRAINT "lesson_blocks_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "learner_block_states_enrollment_block_unique" ON "learner_block_states" USING btree ("enrollment_id","block_id");--> statement-breakpoint
ALTER TABLE "progress" ADD CONSTRAINT "progress_current_block_id_lesson_blocks_id_fk" FOREIGN KEY ("current_block_id") REFERENCES "public"."lesson_blocks"("id") ON DELETE set null ON UPDATE no action;