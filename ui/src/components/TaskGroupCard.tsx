import { useQuery } from "@tanstack/react-query";
import { Link } from "@/lib/router";
import { CheckCircle2, Circle, Clock, XCircle, Loader2, ChevronDown, ChevronRight, Zap } from "lucide-react";
import type { TaskGroup, TaskGroupMember } from "@paperclipai/shared";
import { cn } from "../lib/utils";
import { timeAgo } from "../lib/timeAgo";
import { useState } from "react";
import { taskGroupsApi } from "../api/taskGroups";

// ── Status helpers ────────────────────────────────────────────────────────────

function TaskStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "done":
      return <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />;
    case "cancelled":
    case "failed":
      return <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />;
    case "in_progress":
      return <Loader2 className="h-3.5 w-3.5 text-blue-500 shrink-0 animate-spin" />;
    case "blocked":
      return <XCircle className="h-3.5 w-3.5 text-orange-400 shrink-0" />;
    default:
      return <Circle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
  }
}

function GroupStatusBadge({ status }: { status: TaskGroup["status"] }) {
  const map: Record<TaskGroup["status"], { label: string; className: string }> = {
    pending: { label: "Pending", className: "bg-muted text-muted-foreground" },
    running: { label: "Running", className: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
    completed: { label: "Completed", className: "bg-green-500/10 text-green-600 dark:text-green-400" },
    failed: { label: "Failed", className: "bg-red-500/10 text-red-500" },
    cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground line-through" },
  };
  const { label, className } = map[status] ?? map.pending;
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold", className)}>
      {label}
    </span>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ total, completed, failed }: { total: number; completed: number; failed: number }) {
  if (total === 0) return null;
  const completedPct = Math.round((completed / total) * 100);
  const failedPct = Math.round((failed / total) * 100);
  return (
    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden flex">
      <div
        className="h-full bg-green-500 transition-all duration-300"
        style={{ width: `${completedPct}%` }}
      />
      <div
        className="h-full bg-red-400 transition-all duration-300"
        style={{ width: `${failedPct}%` }}
      />
    </div>
  );
}

// ── Member row ────────────────────────────────────────────────────────────────

function TaskMemberRow({ task, companyPrefix }: { task: TaskGroupMember; companyPrefix?: string }) {
  const path = companyPrefix ? `/${companyPrefix}/issues/${task.id}` : `/issues/${task.id}`;
  return (
    <Link
      to={path}
      className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent/50 rounded transition-colors no-underline text-inherit"
    >
      <TaskStatusIcon status={task.status} />
      <span className="flex-1 truncate">{task.title}</span>
      {task.assigneeAgentName && (
        <span className="text-[10px] text-muted-foreground shrink-0 hidden sm:inline">
          {task.assigneeAgentName}
        </span>
      )}
      {task.dependsOn.length > 0 && (
        <span className="text-[10px] text-muted-foreground shrink-0" title={`Depends on ${task.dependsOn.length} task(s)`}>
          <Clock className="h-2.5 w-2.5 inline -mt-0.5" /> dep
        </span>
      )}
    </Link>
  );
}

// ── Main card ─────────────────────────────────────────────────────────────────

interface TaskGroupCardProps {
  group: TaskGroup;
  companyPrefix?: string;
  defaultExpanded?: boolean;
  className?: string;
}

export function TaskGroupCard({ group, companyPrefix, defaultExpanded = false, className }: TaskGroupCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const total = group.totalCount ?? group.tasks?.length ?? 0;
  const completed = group.completedCount ?? 0;
  const failed = group.failedCount ?? 0;

  return (
    <div className={cn("rounded-lg border border-border bg-card", className)}>
      {/* Header */}
      <button
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
        onClick={() => setExpanded((p) => !p)}
      >
        <Zap className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
        <span className="flex-1 min-w-0">
          <span className="text-sm font-semibold truncate block">{group.name}</span>
        </span>
        <GroupStatusBadge status={group.status} />
        <span className="text-xs text-muted-foreground shrink-0 ml-1">
          {completed}/{total}
        </span>
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
      </button>

      {/* Progress bar */}
      <div className="px-3 pb-1.5">
        <ProgressBar total={total} completed={completed} failed={failed} />
      </div>

      {/* Expanded task list */}
      {expanded && group.tasks && group.tasks.length > 0 && (
        <div className="border-t border-border px-1 pb-1 pt-1">
          {group.tasks.map((task) => (
            <TaskMemberRow key={task.id} task={task} companyPrefix={companyPrefix} />
          ))}
        </div>
      )}

      {/* Footer: timing */}
      {(group.status === "completed" || group.status === "failed") && group.completedAt && (
        <div className="px-3 py-1.5 text-[10px] text-muted-foreground border-t border-border">
          {group.status === "completed" ? "Completed" : "Failed"} {timeAgo(group.completedAt)}
        </div>
      )}
    </div>
  );
}

// ── Fetched card (for use when you only have the group ID) ────────────────────

export function TaskGroupCardById({
  groupId,
  companyPrefix,
  className,
}: {
  groupId: string;
  companyPrefix?: string;
  className?: string;
}) {
  const { data: group, isLoading } = useQuery<TaskGroup>({
    queryKey: ["task-groups", groupId],
    queryFn: () => taskGroupsApi.get(groupId),
    refetchInterval: 5000, // Poll every 5s as per spec
    refetchIntervalInBackground: false,
  });

  if (isLoading) {
    return (
      <div className={cn("rounded-lg border border-border bg-card px-3 py-2.5 flex items-center gap-2", className)}>
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading task group…</span>
      </div>
    );
  }
  if (!group) return null;

  return <TaskGroupCard group={group} companyPrefix={companyPrefix} className={className} />;
}
