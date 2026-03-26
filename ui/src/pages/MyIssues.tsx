import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { issuesApi } from "../api/issues";
import { projectsApi } from "../api/projects";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { StatusIcon } from "../components/StatusIcon";
import { PriorityIcon } from "../components/PriorityIcon";
import { EntityRow } from "../components/EntityRow";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { formatDate } from "../lib/utils";
import { ListTodo } from "lucide-react";

export function MyIssues() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([{ label: "My Issues" }]);
  }, [setBreadcrumbs]);

  const { data: issues, isLoading, error } = useQuery({
    queryKey: queryKeys.issues.list(selectedCompanyId!),
    queryFn: () => issuesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: projects } = useQuery({
    queryKey: queryKeys.projects.list(selectedCompanyId!),
    queryFn: () => projectsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    staleTime: 60_000,
  });
  const projectById = useMemo(() => {
    const map = new Map<string, { name: string; color?: string | null }>();
    for (const p of projects ?? []) map.set(p.id, p);
    return map;
  }, [projects]);

  if (!selectedCompanyId) {
    return <EmptyState icon={ListTodo} message="Select a company to view your issues." />;
  }

  if (isLoading) {
    return <PageSkeleton variant="list" />;
  }

  // Show issues that are not assigned (user-created or unassigned)
  const myIssues = (issues ?? []).filter(
    (i) => !i.assigneeAgentId && !["done", "cancelled"].includes(i.status)
  );

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {myIssues.length === 0 && (
        <EmptyState icon={ListTodo} message="No issues assigned to you." />
      )}

      {myIssues.length > 0 && (
        <div className="border border-border">
          {myIssues.map((issue) => {
            const proj = issue.projectId ? projectById.get(issue.projectId) : undefined;
            return (
              <EntityRow
                key={issue.id}
                identifier={issue.identifier ?? issue.id.slice(0, 8)}
                title={issue.title}
                to={`/issues/${issue.identifier ?? issue.id}`}
                leading={
                  <>
                    <PriorityIcon priority={issue.priority} />
                    <StatusIcon status={issue.status} />
                  </>
                }
                trailing={
                  <div className="flex items-center gap-2">
                    {proj && (
                      <span
                        className="hidden text-[10px] font-medium px-1.5 py-0.5 rounded-full sm:inline"
                        style={{ background: `${proj.color ?? "#6366F1"}20`, color: proj.color ?? "#6366F1" }}
                      >
                        {proj.name}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatDate(issue.createdAt)}
                    </span>
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
