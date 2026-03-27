import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";

export const taskGroups = pgTable(
  "task_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    name: text("name").notNull(),
    status: text("status").notNull().default("pending"),
    createdByAgentId: uuid("created_by_agent_id").references(() => agents.id),
    fanInAgentId: uuid("fan_in_agent_id").references(() => agents.id),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyStatusIdx: index("task_groups_company_status_idx").on(table.companyId, table.status),
    companyCreatedAtIdx: index("task_groups_company_created_at_idx").on(table.companyId, table.createdAt),
  }),
);
