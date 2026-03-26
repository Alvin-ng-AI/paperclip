import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { goalsApi } from "../api/goals";
import { issuesApi } from "../api/issues";
import { useCompany } from "../context/CompanyContext";
import { useDialog } from "../context/DialogContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { GoalTree } from "../components/GoalTree";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { Button } from "@/components/ui/button";
import { Target, Plus } from "lucide-react";
import type { Goal, Issue } from "@paperclipai/shared";

export function Goals() {
  const { selectedCompanyId } = useCompany();
  const { openNewGoal } = useDialog();
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([{ label: "Goals" }]);
  }, [setBreadcrumbs]);

  const { data: goals, isLoading, error } = useQuery({
    queryKey: queryKeys.goals.list(selectedCompanyId!),
    queryFn: () => goalsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: activeIssues } = useQuery({
    queryKey: [...queryKeys.issues.list(selectedCompanyId!), "active-for-goals"],
    queryFn: () => issuesApi.list(selectedCompanyId!, { status: "todo,in_progress,blocked,in_review" }),
    enabled: !!selectedCompanyId && (goals?.length ?? 0) > 0,
    staleTime: 60_000,
    refetchInterval: 2 * 60_000,
  });

  const goalStats = useMemo(() => {
    const map = new Map<string, { blocked: number; review: number; active: number }>();
    for (const issue of (activeIssues ?? []) as Issue[]) {
      if (!issue.goalId) continue;
      const cur = map.get(issue.goalId) ?? { blocked: 0, review: 0, active: 0 };
      if (issue.status === "blocked") cur.blocked++;
      else if (issue.status === "in_review") cur.review++;
      else cur.active++;
      map.set(issue.goalId, cur);
    }
    return map;
  }, [activeIssues]);

  if (!selectedCompanyId) {
    return <EmptyState icon={Target} message="Select a company to view goals." />;
  }

  if (isLoading) {
    return <PageSkeleton variant="list" />;
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {goals && goals.length === 0 && (
        <EmptyState
          icon={Target}
          message="No goals yet."
          action="Add Goal"
          onAction={() => openNewGoal()}
        />
      )}

      {goals && goals.length > 0 && (
        <>
          <div className="flex items-center justify-start">
            <Button size="sm" variant="outline" onClick={() => openNewGoal()}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              New Goal
            </Button>
          </div>
          <GoalTree
            goals={goals}
            goalLink={(goal) => `/goals/${goal.id}`}
            trailingContent={(goal: Goal) => {
              const stats = goalStats.get(goal.id);
              if (!stats || (stats.blocked + stats.review + stats.active) === 0) return null;
              return (
                <span className="flex items-center gap-1 mr-1">
                  {stats.blocked > 0 && (
                    <span className="text-[10px] font-medium px-1 py-0.5 rounded bg-red-500/10 text-red-500">
                      {stats.blocked} blocked
                    </span>
                  )}
                  {stats.review > 0 && (
                    <span className="text-[10px] font-medium px-1 py-0.5 rounded bg-amber-500/10 text-amber-500">
                      {stats.review} review
                    </span>
                  )}
                  {stats.active > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      {stats.active} active
                    </span>
                  )}
                </span>
              );
            }}
          />
        </>
      )}
    </div>
  );
}
