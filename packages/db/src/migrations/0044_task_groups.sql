CREATE TABLE IF NOT EXISTS "task_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_by_agent_id" uuid,
	"fan_in_agent_id" uuid,
	"metadata" jsonb DEFAULT '{}',
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN IF NOT EXISTS "task_group_id" uuid;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN IF NOT EXISTS "depends_on" uuid[] DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN IF NOT EXISTS "parallel_output" jsonb;--> statement-breakpoint
ALTER TABLE "task_groups" ADD CONSTRAINT "task_groups_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_groups" ADD CONSTRAINT "task_groups_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_groups" ADD CONSTRAINT "task_groups_fan_in_agent_id_agents_id_fk" FOREIGN KEY ("fan_in_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_task_group_id_task_groups_id_fk" FOREIGN KEY ("task_group_id") REFERENCES "public"."task_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_groups_company_status_idx" ON "task_groups" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_groups_company_created_at_idx" ON "task_groups" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "issues_task_group_idx" ON "issues" USING btree ("task_group_id");--> statement-breakpoint
-- Raise maxConcurrentRuns from 1 → 5 for all agents that haven't been explicitly tuned above 1.
-- This enables parallel task group execution. Agents with maxConcurrentRuns > 1 already are left untouched.
UPDATE "agents"
SET "runtime_config" = jsonb_set(
  COALESCE("runtime_config", '{}'),
  '{heartbeat,maxConcurrentRuns}',
  '5'
)
WHERE (
  "runtime_config" -> 'heartbeat' -> 'maxConcurrentRuns' IS NULL
  OR ("runtime_config" -> 'heartbeat' -> 'maxConcurrentRuns')::int <= 1
)
AND "status" NOT IN ('terminated', 'pending_approval');
