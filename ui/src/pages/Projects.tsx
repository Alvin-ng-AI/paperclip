import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { projectsApi } from "../api/projects";
import { issuesApi } from "../api/issues";
import { useCompany } from "../context/CompanyContext";
import { useDialog } from "../context/DialogContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { EntityRow } from "../components/EntityRow";
import { StatusBadge } from "../components/StatusBadge";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { formatDate, projectUrl } from "../lib/utils";
import { Button } from "@/components/ui/button";
import { Hexagon, Plus } from "lucide-react";
import type { Issue } from "@paperclipai/shared";

export function Projects() {
  const { selectedCompanyId } = useCompany();
  const { openNewProject } = useDialog();
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([{ label: "Projects" }]);
  }, [setBreadcrumbs]);

  const { data: allProjects, isLoading, error } = useQuery({
    queryKey: queryKeys.projects.list(selectedCompanyId!),
    queryFn: () => projectsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const projects = useMemo(
    () => (allProjects ?? []).filter((p) => !p.archivedAt),
    [allProjects],
  );

  // Fetch active issues to compute per-project stats
  const { data: activeIssues } = useQuery({
    queryKey: [...queryKeys.issues.list(selectedCompanyId!), "active-for-projects"],
    queryFn: () => issuesApi.list(selectedCompanyId!, { status: "todo,in_progress,blocked,in_review" }),
    enabled: !!selectedCompanyId && projects.length > 0,
    staleTime: 60_000,
    refetchInterval: 2 * 60_000,
  });

  const projectStats = useMemo(() => {
    const map = new Map<string, { blocked: number; review: number; active: number }>();
    for (const issue of (activeIssues ?? []) as Issue[]) {
      if (!issue.projectId) continue;
      const cur = map.get(issue.projectId) ?? { blocked: 0, review: 0, active: 0 };
      if (issue.status === "blocked") cur.blocked++;
      else if (issue.status === "in_review") cur.review++;
      else cur.active++;
      map.set(issue.projectId, cur);
    }
    return map;
  }, [activeIssues]);

  if (!selectedCompanyId) {
    return <EmptyState icon={Hexagon} message="Select a company to view projects." />;
  }

  if (isLoading) {
    return <PageSkeleton variant="list" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button size="sm" variant="outline" onClick={openNewProject}>
          <Plus className="h-4 w-4 mr-1" />
          Add Project
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {!isLoading && projects.length === 0 && (
        <EmptyState
          icon={Hexagon}
          message="No projects yet."
          action="Add Project"
          onAction={openNewProject}
        />
      )}

      {projects.length > 0 && (
        <div className="border border-border">
          {projects.map((project) => {
            const stats = projectStats.get(project.id);
            return (
              <EntityRow
                key={project.id}
                title={project.name}
                subtitle={project.description ?? undefined}
                to={projectUrl(project)}
                trailing={
                  <div className="flex items-center gap-3">
                    {stats && (stats.blocked + stats.review + stats.active) > 0 && (
                      <div className="flex items-center gap-1.5 text-xs">
                        {stats.blocked > 0 && (
                          <span className="font-medium" style={{ color: "#EF4444" }}>
                            {stats.blocked}🔴
                          </span>
                        )}
                        {stats.review > 0 && (
                          <span className="font-medium" style={{ color: "#F59E0B" }}>
                            {stats.review}🔔
                          </span>
                        )}
                        {stats.active > 0 && (
                          <span className="text-muted-foreground">
                            {stats.active} active
                          </span>
                        )}
                      </div>
                    )}
                    {project.targetDate && (
                      <span className="text-xs text-muted-foreground">
                        {formatDate(project.targetDate)}
                      </span>
                    )}
                    <StatusBadge status={project.status} />
                  </div>
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
