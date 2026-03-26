import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { activityApi } from "../api/activity";
import { agentsApi } from "../api/agents";
import { issuesApi } from "../api/issues";
import { projectsApi } from "../api/projects";
import { goalsApi } from "../api/goals";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { EmptyState } from "../components/EmptyState";
import { ActivityRow } from "../components/ActivityRow";
import { PageSkeleton } from "../components/PageSkeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { History } from "lucide-react";
import type { Agent } from "@paperclipai/shared";

const DATE_RANGES = [
  { value: "today", label: "Today" },
  { value: "24h", label: "Last 24h" },
  { value: "7d", label: "Last 7 days" },
  { value: "all", label: "All time" },
];

function cutoffFromRange(range: string): Date | null {
  const now = new Date();
  if (range === "today") {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (range === "24h") return new Date(now.getTime() - 24 * 60 * 60_000);
  if (range === "7d") return new Date(now.getTime() - 7 * 24 * 60 * 60_000);
  return null;
}

export function Activity() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const [typeFilter, setTypeFilter] = useState("all");
  const [agentFilter, setAgentFilter] = useState("all");
  const [dateRange, setDateRange] = useState("today");

  useEffect(() => {
    setBreadcrumbs([{ label: "Activity" }]);
  }, [setBreadcrumbs]);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.activity(selectedCompanyId!),
    queryFn: () => activityApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 60_000,
  });

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: issues } = useQuery({
    queryKey: queryKeys.issues.list(selectedCompanyId!),
    queryFn: () => issuesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: projects } = useQuery({
    queryKey: queryKeys.projects.list(selectedCompanyId!),
    queryFn: () => projectsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: goals } = useQuery({
    queryKey: queryKeys.goals.list(selectedCompanyId!),
    queryFn: () => goalsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const agentMap = useMemo(() => {
    const map = new Map<string, Agent>();
    for (const a of agents ?? []) map.set(a.id, a);
    return map;
  }, [agents]);

  const entityNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of issues ?? []) map.set(`issue:${i.id}`, i.identifier ?? i.id.slice(0, 8));
    for (const a of agents ?? []) map.set(`agent:${a.id}`, a.name);
    for (const p of projects ?? []) map.set(`project:${p.id}`, p.name);
    for (const g of goals ?? []) map.set(`goal:${g.id}`, g.title);
    return map;
  }, [issues, agents, projects, goals]);

  const entityTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of issues ?? []) map.set(`issue:${i.id}`, i.title);
    return map;
  }, [issues]);

  // Agents that have appeared in activity (for filter dropdown)
  const activeAgentIds = useMemo(() => {
    const ids = new Set<string>();
    for (const e of data ?? []) {
      if (e.actorType === "agent" && e.actorId) ids.add(e.actorId);
    }
    return ids;
  }, [data]);

  const entityTypes = useMemo(
    () => (data ? [...new Set(data.map((e) => e.entityType))].sort() : []),
    [data],
  );

  const filtered = useMemo(() => {
    if (!data) return data;
    const cutoff = cutoffFromRange(dateRange);
    return data.filter((e) => {
      if (typeFilter !== "all" && e.entityType !== typeFilter) return false;
      if (agentFilter !== "all" && (e.actorType !== "agent" || e.actorId !== agentFilter)) return false;
      if (cutoff && new Date(e.createdAt) < cutoff) return false;
      return true;
    });
  }, [data, typeFilter, agentFilter, dateRange]);

  if (!selectedCompanyId) {
    return <EmptyState icon={History} message="Select a company to view activity." />;
  }

  if (isLoading) {
    return <PageSkeleton variant="list" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap justify-end">
        {/* Date range */}
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="w-[120px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DATE_RANGES.map((r) => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Agent filter */}
        <Select value={agentFilter} onValueChange={setAgentFilter}>
          <SelectTrigger className="w-[150px] h-8 text-xs">
            <SelectValue placeholder="All agents" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actors</SelectItem>
            {[...activeAgentIds].map((id) => {
              const agent = agentMap.get(id);
              return (
                <SelectItem key={id} value={id}>
                  {agent?.name ?? id.slice(0, 8)}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        {/* Entity type filter */}
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[130px] h-8 text-xs">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {entityTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Result count */}
      {filtered && (
        <p className="text-xs text-muted-foreground">
          {filtered.length} event{filtered.length !== 1 ? "s" : ""}
          {filtered.length !== (data?.length ?? 0) ? ` (filtered from ${data?.length ?? 0})` : ""}
        </p>
      )}

      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {filtered && filtered.length === 0 && (
        <EmptyState icon={History} message="No activity matching these filters." />
      )}

      {filtered && filtered.length > 0 && (
        <div className="border border-border divide-y divide-border">
          {filtered.map((event) => (
            <ActivityRow
              key={event.id}
              event={event}
              agentMap={agentMap}
              entityNameMap={entityNameMap}
              entityTitleMap={entityTitleMap}
            />
          ))}
        </div>
      )}
    </div>
  );
}
