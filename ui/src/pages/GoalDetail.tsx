import { useEffect, useMemo } from "react";
import { useParams, Link } from "@/lib/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { goalsApi } from "../api/goals";
import { projectsApi } from "../api/projects";
import { issuesApi } from "../api/issues";
import { assetsApi } from "../api/assets";
import { usePanel } from "../context/PanelContext";
import { useCompany } from "../context/CompanyContext";
import { useDialog } from "../context/DialogContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { GoalProperties } from "../components/GoalProperties";
import { GoalTree } from "../components/GoalTree";
import { StatusBadge } from "../components/StatusBadge";
import { StatusIcon } from "../components/StatusIcon";
import { PriorityIcon } from "../components/PriorityIcon";
import { InlineEditor } from "../components/InlineEditor";
import { EntityRow } from "../components/EntityRow";
import { PageSkeleton } from "../components/PageSkeleton";
import { projectUrl } from "../lib/utils";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, Plus } from "lucide-react";
import type { Goal, Issue, Project } from "@paperclipai/shared";

export function GoalDetail() {
  const { goalId } = useParams<{ goalId: string }>();
  const { selectedCompanyId, setSelectedCompanyId } = useCompany();
  const { openNewGoal, openNewIssue } = useDialog();
  const { openPanel, closePanel } = usePanel();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();

  const {
    data: goal,
    isLoading,
    error
  } = useQuery({
    queryKey: queryKeys.goals.detail(goalId!),
    queryFn: () => goalsApi.get(goalId!),
    enabled: !!goalId
  });
  const resolvedCompanyId = goal?.companyId ?? selectedCompanyId;

  const { data: allGoals } = useQuery({
    queryKey: queryKeys.goals.list(resolvedCompanyId!),
    queryFn: () => goalsApi.list(resolvedCompanyId!),
    enabled: !!resolvedCompanyId
  });

  const { data: allProjects } = useQuery({
    queryKey: queryKeys.projects.list(resolvedCompanyId!),
    queryFn: () => projectsApi.list(resolvedCompanyId!),
    enabled: !!resolvedCompanyId
  });

  useEffect(() => {
    if (!goal?.companyId || goal.companyId === selectedCompanyId) return;
    setSelectedCompanyId(goal.companyId, { source: "route_sync" });
  }, [goal?.companyId, selectedCompanyId, setSelectedCompanyId]);

  const updateGoal = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      goalsApi.update(goalId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.goals.detail(goalId!)
      });
      if (resolvedCompanyId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.goals.list(resolvedCompanyId)
        });
      }
    }
  });

  const uploadImage = useMutation({
    mutationFn: async (file: File) => {
      if (!resolvedCompanyId) throw new Error("No company selected");
      return assetsApi.uploadImage(
        resolvedCompanyId,
        file,
        `goals/${goalId ?? "draft"}`
      );
    }
  });

  const { data: allIssues } = useQuery({
    queryKey: queryKeys.issues.list(resolvedCompanyId!),
    queryFn: () => issuesApi.list(resolvedCompanyId!),
    enabled: !!resolvedCompanyId,
    staleTime: 60_000,
  });

  const approveIssue = useMutation({
    mutationFn: (issueId: string) => issuesApi.update(issueId, { status: "done" }),
    onSuccess: () => {
      if (resolvedCompanyId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.issues.list(resolvedCompanyId) });
      }
    },
  });

  const childGoals = (allGoals ?? []).filter((g) => g.parentId === goalId);
  const linkedProjects = (allProjects ?? []).filter((p) => {
    if (!goalId) return false;
    if (p.goalIds.includes(goalId)) return true;
    if (p.goals.some((goalRef) => goalRef.id === goalId)) return true;
    return p.goalId === goalId;
  });

  const linkedProjectIds = useMemo(
    () => new Set(linkedProjects.map((p) => p.id)),
    [linkedProjects],
  );

  const goalIssues = useMemo(
    () => (allIssues ?? []).filter(
      (i: Issue) => (i.projectId && linkedProjectIds.has(i.projectId)) ||
        (i as Issue & { goalId?: string }).goalId === goalId
    ).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [allIssues, linkedProjectIds, goalId],
  );

  const activeGoalIssues = goalIssues.filter((i) => !["done", "cancelled"].includes(i.status));
  const doneGoalIssues = goalIssues.filter((i) => i.status === "done");

  useEffect(() => {
    setBreadcrumbs([
      { label: "Goals", href: "/goals" },
      { label: goal?.title ?? goalId ?? "Goal" }
    ]);
  }, [setBreadcrumbs, goal, goalId]);

  useEffect(() => {
    if (goal) {
      openPanel(
        <GoalProperties
          goal={goal}
          onUpdate={(data) => updateGoal.mutate(data)}
        />
      );
    }
    return () => closePanel();
  }, [goal]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) return <PageSkeleton variant="detail" />;
  if (error) return <p className="text-sm text-destructive">{error.message}</p>;
  if (!goal) return null;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase text-muted-foreground">
            {goal.level}
          </span>
          <StatusBadge status={goal.status} />
        </div>

        <InlineEditor
          value={goal.title}
          onSave={(title) => updateGoal.mutate({ title })}
          as="h2"
          className="text-xl font-bold"
        />

        <InlineEditor
          value={goal.description ?? ""}
          onSave={(description) => updateGoal.mutate({ description })}
          as="p"
          className="text-sm text-muted-foreground"
          placeholder="Add a description..."
          multiline
          imageUploadHandler={async (file) => {
            const asset = await uploadImage.mutateAsync(file);
            return asset.contentPath;
          }}
        />
      </div>

      {goalIssues.length > 0 && (() => {
        const blocked = activeGoalIssues.filter(i => i.status === "blocked").length;
        const review = activeGoalIssues.filter(i => i.status === "in_review").length;
        const active = activeGoalIssues.filter(i => i.status !== "blocked" && i.status !== "in_review").length;
        const done = doneGoalIssues.length;
        const total = done + activeGoalIssues.length;
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        return (
          <div className="space-y-3 rounded-lg border border-border p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Progress</span>
              <span className="text-sm font-semibold tabular-nums" style={{ color: pct === 100 ? "#22C55E" : "inherit" }}>
                {pct}% — {done}/{total} done
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden bg-muted">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${pct}%`,
                  background: pct === 100 ? "#22C55E" : blocked > 0 ? "#EF4444" : "#6366F1",
                }}
              />
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {blocked > 0 && <span className="font-medium text-red-500">🔴 {blocked} blocked</span>}
              {review > 0 && <span className="font-medium text-amber-500">🔔 {review} review</span>}
              {active > 0 && <span>🟡 {active} active</span>}
              {done > 0 && <span className="text-green-600">✅ {done} done</span>}
            </div>
          </div>
        );
      })()}

      <Tabs defaultValue="children">
        <TabsList>
          <TabsTrigger value="children">
            Sub-Goals ({childGoals.length})
          </TabsTrigger>
          <TabsTrigger value="projects">
            Projects ({linkedProjects.length})
          </TabsTrigger>
          <TabsTrigger value="issues">
            Issues {goalIssues.length > 0 && `(${goalIssues.length})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="children" className="mt-4 space-y-3">
          <div className="flex items-center justify-start">
            <Button
              size="sm"
              variant="outline"
              onClick={() => openNewGoal({ parentId: goalId })}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Sub Goal
            </Button>
          </div>
          {childGoals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sub-goals.</p>
          ) : (
            <GoalTree goals={childGoals} goalLink={(g) => `/goals/${g.id}`} />
          )}
        </TabsContent>

        <TabsContent value="projects" className="mt-4">
          {linkedProjects.length === 0 ? (
            <p className="text-sm text-muted-foreground">No linked projects.</p>
          ) : (
            <div className="border border-border">
              {linkedProjects.map((project) => (
                <EntityRow
                  key={project.id}
                  title={project.name}
                  subtitle={project.description ?? undefined}
                  to={projectUrl(project)}
                  trailing={<StatusBadge status={project.status} />}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="issues" className="mt-4 space-y-4">
          <div className="flex items-center justify-start">
            <Button
              size="sm"
              variant="outline"
              onClick={() => openNewIssue({ goalId: goalId ?? undefined })}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              New Issue
            </Button>
          </div>
          {goalIssues.length === 0 ? (
            <p className="text-sm text-muted-foreground">No issues linked to this goal.</p>
          ) : (
            <>
              {activeGoalIssues.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Active ({activeGoalIssues.length})</p>
                  <div className="border border-border rounded-lg divide-y divide-border">
                    {activeGoalIssues.slice(0, 20).map((issue) => (
                      <Link
                        key={issue.id}
                        to={`/issues/${issue.identifier ?? issue.id}`}
                        className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent/20 transition-colors no-underline text-inherit"
                      >
                        <StatusIcon status={issue.status} />
                        <PriorityIcon priority={issue.priority} />
                        <span className="font-mono text-xs text-muted-foreground shrink-0">{issue.identifier ?? issue.id.slice(0, 8)}</span>
                        <span className="truncate flex-1">{issue.title}</span>
                        {issue.status === "in_review" ? (
                          <button
                            className="hidden shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold transition-colors hover:bg-green-500/20 md:flex"
                            style={{ color: "#22C55E", border: "1px solid rgba(34,197,94,0.3)" }}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              approveIssue.mutate(issue.id);
                            }}
                          >
                            <Check className="h-3 w-3" />
                            Approve
                          </button>
                        ) : (
                          <StatusBadge status={issue.status} />
                        )}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              {doneGoalIssues.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Done ({doneGoalIssues.length})</p>
                  <div className="border border-border rounded-lg divide-y divide-border">
                    {doneGoalIssues.slice(0, 10).map((issue) => (
                      <Link
                        key={issue.id}
                        to={`/issues/${issue.identifier ?? issue.id}`}
                        className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent/20 transition-colors no-underline text-inherit opacity-60"
                      >
                        <StatusIcon status={issue.status} />
                        <span className="font-mono text-xs text-muted-foreground shrink-0">{issue.identifier ?? issue.id.slice(0, 8)}</span>
                        <span className="truncate flex-1">{issue.title}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
