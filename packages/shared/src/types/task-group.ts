export type TaskGroupStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export interface TaskGroup {
  id: string;
  companyId: string;
  name: string;
  status: TaskGroupStatus;
  createdByAgentId: string | null;
  fanInAgentId: string | null;
  metadata: Record<string, unknown>;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  /** Populated when fetching with tasks */
  tasks?: TaskGroupMember[];
  totalCount?: number;
  completedCount?: number;
  failedCount?: number;
}

export interface TaskGroupMember {
  id: string;
  title: string;
  status: string;
  assigneeAgentId: string | null;
  assigneeAgentName?: string | null;
  dependsOn: string[];
  parallelOutput: Record<string, unknown> | null;
  completedAt: Date | null;
  updatedAt: Date;
}

export interface CreateTaskGroupInput {
  name: string;
  fanInAgentId?: string | null;
  metadata?: Record<string, unknown>;
  tasks: CreateTaskGroupTaskInput[];
}

export interface CreateTaskGroupTaskInput {
  title: string;
  description?: string;
  assigneeAgentId?: string;
  priority?: string;
  projectId?: string;
  goalId?: string;
  /** Titles of tasks this task depends on (resolved to IDs after creation) */
  dependsOnTitles?: string[];
  /** IDs of tasks this task depends on */
  dependsOn?: string[];
}
