/**
 * TaskOrchestrator — fan-out / fan-in parallel agent execution.
 *
 * Flow:
 *   1. CEO calls createTaskGroup() with a list of tasks + dependencies
 *   2. fanOut() dispatches all tasks whose dependencies are already satisfied
 *   3. onTaskComplete() is called when a task transitions to done/failed
 *      — re-evaluates readiness and dispatches newly-unblocked tasks
 *      — when all tasks are terminal, calls fanIn() to wake the fan-in agent
 *   4. The fan-in agent synthesises results and marks the group completed
 *
 * Rate limiter: max 8 concurrent Claude API calls across all parallel tasks.
 */

import { and, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { agents, issues, taskGroups } from "@paperclipai/db";
import type { CreateTaskGroupInput, TaskGroup, TaskGroupMember } from "@paperclipai/shared";
import { notFound, unprocessable } from "../errors.js";
import { issueService } from "./issues.js";
import { heartbeatService } from "./heartbeat.js";

/** Max simultaneous Claude API calls across all parallel tasks (company-wide). */
const MAX_CONCURRENT_CLAUDE_CALLS = 8;

type IssueRow = typeof issues.$inferSelect;
type TaskGroupRow = typeof taskGroups.$inferSelect;

function toTaskGroupMember(issue: IssueRow & { agentName?: string | null }): TaskGroupMember {
  return {
    id: issue.id,
    title: issue.title,
    status: issue.status,
    assigneeAgentId: issue.assigneeAgentId,
    assigneeAgentName: issue.agentName ?? null,
    dependsOn: (issue.dependsOn as string[] | null) ?? [],
    parallelOutput: (issue.parallelOutput as Record<string, unknown> | null) ?? null,
    completedAt: issue.completedAt,
    updatedAt: issue.updatedAt,
  };
}

function toTaskGroup(row: TaskGroupRow, tasks?: TaskGroupMember[]): TaskGroup {
  const completedCount = tasks?.filter((t) => t.status === "done").length ?? 0;
  const failedCount = tasks?.filter((t) => t.status === "failed" || t.status === "cancelled").length ?? 0;
  return {
    id: row.id,
    companyId: row.companyId,
    name: row.name,
    status: row.status as TaskGroup["status"],
    createdByAgentId: row.createdByAgentId,
    fanInAgentId: row.fanInAgentId,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    completedAt: row.completedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    tasks,
    totalCount: tasks?.length ?? 0,
    completedCount,
    failedCount,
  };
}

export function taskOrchestratorService(db: Db) {
  const issueSvc = issueService(db);
  const heartbeat = heartbeatService(db);

  // ── Helpers ────────────────────────────────────────────────────────────────

  async function getGroup(groupId: string): Promise<TaskGroupRow> {
    const row = await db
      .select()
      .from(taskGroups)
      .where(eq(taskGroups.id, groupId))
      .then((rows) => rows[0] ?? null);
    if (!row) throw notFound("Task group not found");
    return row;
  }

  async function getGroupTasks(groupId: string): Promise<IssueRow[]> {
    return db.select().from(issues).where(eq(issues.taskGroupId, groupId));
  }

  /**
   * Count how many tasks belonging to this company are currently
   * in_progress (i.e. actively running a Claude call). Used to enforce
   * the MAX_CONCURRENT_CLAUDE_CALLS token bucket.
   */
  async function countRunningParallelTasks(companyId: string): Promise<number> {
    const rows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(issues)
      .where(
        and(
          eq(issues.companyId, companyId),
          eq(issues.status, "in_progress"),
          sql`${issues.taskGroupId} IS NOT NULL`,
        ),
      );
    return rows[0]?.count ?? 0;
  }

  /**
   * Determine which tasks in the group are ready to run (all deps done).
   */
  function readyTasks(allTasks: IssueRow[]): IssueRow[] {
    const doneIds = new Set(
      allTasks
        .filter((t) => t.status === "done" || t.status === "cancelled")
        .map((t) => t.id),
    );
    return allTasks.filter((t) => {
      if (t.status !== "todo" && t.status !== "backlog") return false;
      const deps = (t.dependsOn as string[] | null) ?? [];
      return deps.every((depId) => doneIds.has(depId));
    });
  }

  /**
   * Check if the group is fully terminal (all tasks done, failed, or cancelled).
   */
  function isGroupTerminal(tasks: IssueRow[]): boolean {
    const terminalStatuses = new Set(["done", "cancelled", "failed"]);
    return tasks.length > 0 && tasks.every((t) => terminalStatuses.has(t.status));
  }

  // ── Core operations ────────────────────────────────────────────────────────

  /**
   * Dispatch ready tasks, respecting the global concurrency cap.
   * Returns the number of tasks dispatched.
   */
  async function fanOut(groupId: string): Promise<number> {
    const group = await getGroup(groupId);
    if (group.status === "completed" || group.status === "cancelled") return 0;

    const allTasks = await getGroupTasks(groupId);
    const ready = readyTasks(allTasks);
    if (ready.length === 0) return 0;

    // Check global concurrency budget
    const running = await countRunningParallelTasks(group.companyId);
    const slots = Math.max(0, MAX_CONCURRENT_CLAUDE_CALLS - running);
    const toDispatch = ready.slice(0, slots);

    // Mark group as running if it was pending
    if (group.status === "pending" && toDispatch.length > 0) {
      await db
        .update(taskGroups)
        .set({ status: "running", updatedAt: new Date() })
        .where(eq(taskGroups.id, groupId));
    }

    let dispatched = 0;
    for (const task of toDispatch) {
      if (!task.assigneeAgentId) continue;
      try {
        await heartbeat.wakeup(task.assigneeAgentId, {
          source: "automation",
          triggerDetail: "system",
          contextSnapshot: { issueId: task.id, taskGroupId: groupId },
        });
        dispatched++;
      } catch {
        // Log but don't abort — other tasks should still run
      }
    }

    return dispatched;
  }

  /**
   * Called when a task transitions to a terminal status.
   * Re-evaluates readiness and dispatches newly-unblocked tasks.
   * If the group is fully terminal, triggers fan-in.
   */
  async function onTaskComplete(taskId: string, output?: Record<string, unknown>): Promise<void> {
    const task = await db
      .select()
      .from(issues)
      .where(eq(issues.id, taskId))
      .then((rows) => rows[0] ?? null);
    if (!task?.taskGroupId) return;

    // Persist output
    if (output && Object.keys(output).length > 0) {
      await db
        .update(issues)
        .set({ parallelOutput: output, updatedAt: new Date() })
        .where(eq(issues.id, taskId));
    }

    const groupId = task.taskGroupId;
    const allTasks = await getGroupTasks(groupId);

    if (isGroupTerminal(allTasks)) {
      await fanIn(groupId, allTasks);
    } else {
      // Dispatch any newly-unblocked tasks
      await fanOut(groupId);
    }
  }

  /**
   * All tasks in the group are terminal — wake the fan-in agent to synthesise results.
   */
  async function fanIn(groupId: string, tasks: IssueRow[]): Promise<void> {
    const group = await getGroup(groupId);
    const failedCount = tasks.filter((t) => t.status !== "done").length;
    const newStatus = failedCount === tasks.length ? "failed" : "completed";

    await db
      .update(taskGroups)
      .set({ status: newStatus, completedAt: new Date(), updatedAt: new Date() })
      .where(eq(taskGroups.id, groupId));

    if (group.fanInAgentId) {
      try {
        await heartbeat.wakeup(group.fanInAgentId, {
          source: "automation",
          triggerDetail: "system",
          contextSnapshot: { taskGroupId: groupId, taskGroupStatus: newStatus },
        });
      } catch {
        // Non-fatal — fan-in agent will poll or be woken next heartbeat
      }
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Create a task group with all its member tasks. Immediately fans out
   * tasks that have no dependencies.
   */
  async function createTaskGroup(
    companyId: string,
    createdByAgentId: string | null,
    input: CreateTaskGroupInput,
  ): Promise<TaskGroup> {
    // 1. Create the group record
    const [group] = await db
      .insert(taskGroups)
      .values({
        companyId,
        name: input.name,
        status: "pending",
        createdByAgentId: createdByAgentId ?? undefined,
        fanInAgentId: input.fanInAgentId ?? undefined,
        metadata: input.metadata ?? {},
      })
      .returning();

    if (!group) throw new Error("Failed to create task group");

    // 2. Create tasks (first pass — no depends_on yet, just IDs)
    const createdIssues: IssueRow[] = [];
    const titleToId = new Map<string, string>();

    for (const taskInput of input.tasks) {
      const issue = await issueSvc.create(companyId, {
        title: taskInput.title,
        description: taskInput.description,
        assigneeAgentId: taskInput.assigneeAgentId,
        priority: taskInput.priority ?? "medium",
        projectId: taskInput.projectId,
        goalId: taskInput.goalId,
        status: "todo",
        originKind: "task_group",
        originId: group.id,
        taskGroupId: group.id,
      });
      createdIssues.push(issue as unknown as IssueRow);
      titleToId.set(taskInput.title, issue.id);
    }

    // 3. Second pass — resolve dependsOnTitles to IDs and persist
    for (let i = 0; i < input.tasks.length; i++) {
      const taskInput = input.tasks[i];
      const issue = createdIssues[i];
      if (!issue) continue;

      const deps: string[] = [...(taskInput.dependsOn ?? [])];
      for (const depTitle of taskInput.dependsOnTitles ?? []) {
        const depId = titleToId.get(depTitle);
        if (depId) deps.push(depId);
      }
      if (deps.length > 0) {
        await db
          .update(issues)
          .set({ dependsOn: deps, updatedAt: new Date() })
          .where(eq(issues.id, issue.id));
      }
    }

    // 4. Fan out immediately
    await fanOut(group.id);

    // 5. Return full group
    return getTaskGroup(group.id);
  }

  async function getTaskGroup(groupId: string): Promise<TaskGroup> {
    const group = await getGroup(groupId);
    const tasks = await getGroupTasks(groupId);

    // Hydrate agent names
    const agentIds = [...new Set(tasks.map((t) => t.assigneeAgentId).filter((id): id is string => !!id))];
    const agentNames = new Map<string, string>();
    if (agentIds.length > 0) {
      const agentRows = await db
        .select({ id: agents.id, name: agents.name })
        .from(agents)
        .where(inArray(agents.id, agentIds));
      for (const a of agentRows) agentNames.set(a.id, a.name);
    }

    const members = tasks.map((t) =>
      toTaskGroupMember({ ...t, agentName: t.assigneeAgentId ? agentNames.get(t.assigneeAgentId) : null }),
    );
    return toTaskGroup(group, members);
  }

  async function listTaskGroups(companyId: string, limit = 20): Promise<TaskGroup[]> {
    const rows = await db
      .select()
      .from(taskGroups)
      .where(eq(taskGroups.companyId, companyId))
      .orderBy(sql`${taskGroups.createdAt} desc`)
      .limit(limit);
    return rows.map((r) => toTaskGroup(r));
  }

  async function cancelTaskGroup(groupId: string): Promise<TaskGroup> {
    const group = await getGroup(groupId);
    if (group.status === "completed" || group.status === "cancelled") {
      throw unprocessable("Task group is already terminal");
    }

    // Cancel all non-terminal tasks
    await db
      .update(issues)
      .set({ status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(issues.taskGroupId, groupId),
          inArray(issues.status, ["todo", "backlog", "in_progress", "blocked"]),
        ),
      );

    await db
      .update(taskGroups)
      .set({ status: "cancelled", completedAt: new Date(), updatedAt: new Date() })
      .where(eq(taskGroups.id, groupId));

    return getTaskGroup(groupId);
  }

  return {
    createTaskGroup,
    getTaskGroup,
    listTaskGroups,
    cancelTaskGroup,
    fanOut,
    onTaskComplete,
  };
}
