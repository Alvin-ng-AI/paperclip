import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { issuesApi } from "../api/issues";
import { agentsApi } from "../api/agents";
import { projectsApi } from "../api/projects";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { timeAgo } from "../lib/timeAgo";
import { cn } from "../lib/utils";
import { Link } from "@/lib/router";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusIcon } from "../components/StatusIcon";
import { PageSkeleton } from "../components/PageSkeleton";
import { Search as SearchIcon, CircleDot } from "lucide-react";
import type { Issue } from "@paperclipai/shared";

function LastAgentComment({ issueId }: { issueId: string }) {
  const { data: comments } = useQuery({
    queryKey: ["issue-last-comment", issueId],
    queryFn: () => issuesApi.listComments(issueId),
    staleTime: 5 * 60_000,
    retry: false,
  });
  const last = comments?.length
    ? [...comments].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
    : null;
  if (!last?.body) return null;
  const preview = last.body
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`[^`]+`/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\n{2,}/g, " · ")
    .replace(/\n/g, " ")
    .trim()
    .slice(0, 180);
  if (!preview) return null;
  return (
    <div className="mt-1.5 rounded px-2 py-1.5 border-l-2 border-primary/30 bg-primary/5">
      <div className="text-[9px] uppercase tracking-wider mb-0.5 font-semibold text-primary/70">Agent output</div>
      <p className="text-xs text-muted-foreground line-clamp-2">{preview}</p>
    </div>
  );
}

const STATUSES = [
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "in_review", label: "Pending Review" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
  { value: "cancelled", label: "Cancelled" },
];

const DATE_RANGES = [
  { value: "all", label: "All time" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
];

function cutoffFromRange(range: string): Date | null {
  const now = new Date();
  if (range === "7d") return new Date(now.getTime() - 7 * 86400_000);
  if (range === "30d") return new Date(now.getTime() - 30 * 86400_000);
  if (range === "90d") return new Date(now.getTime() - 90 * 86400_000);
  return null;
}

function descriptionSnippet(description: string | null | undefined, query: string): string | null {
  if (!description) return null;
  const q = query.toLowerCase();
  const idx = q ? description.toLowerCase().indexOf(q) : -1;
  if (idx === -1) {
    return description.slice(0, 120) + (description.length > 120 ? "…" : "");
  }
  const start = Math.max(0, idx - 40);
  const end = Math.min(description.length, idx + query.length + 80);
  return (start > 0 ? "…" : "") + description.slice(start, end) + (end < description.length ? "…" : "");
}

interface SearchResultCardProps {
  issue: Issue;
  agentName?: string;
  project?: { name: string; color?: string | null };
  query: string;
}

function SearchResultCard({ issue, agentName, project, query }: SearchResultCardProps) {
  const issuePathId = issue.identifier ?? issue.id;
  const identifier = issue.identifier ?? issue.id.slice(0, 8);
  const snippet = descriptionSnippet(issue.description, query);

  return (
    <Link
      to={`/issues/${issuePathId}`}
      className="block border border-border rounded-md p-3 hover:bg-accent/50 transition-colors no-underline text-inherit"
    >
      <div className="flex items-start gap-2">
        <StatusIcon status={issue.status} className="mt-0.5 shrink-0 h-4 w-4" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground font-mono shrink-0">{identifier}</span>
            <span className="text-sm font-medium text-foreground truncate">{issue.title}</span>
          </div>
          {snippet && (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{snippet}</p>
          )}
          <LastAgentComment issueId={issue.id} />
          <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            {project && (
              <span
                className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                style={{ background: `${project.color ?? "#6366F1"}20`, color: project.color ?? "#6366F1" }}
              >
                {project.name}
              </span>
            )}
            {agentName && <span>{agentName}</span>}
            <span>{timeAgo(issue.updatedAt)}</span>
            <span className={cn(
              "px-1.5 py-0.5 rounded text-xs font-medium",
              issue.status === "done" ? "bg-green-500/10 text-green-600" :
              issue.status === "in_progress" ? "bg-yellow-500/10 text-yellow-600" :
              issue.status === "blocked" ? "bg-red-500/10 text-red-600" :
              issue.status === "in_review" ? "bg-blue-500/10 text-blue-600" :
              "bg-muted text-muted-foreground"
            )}>
              {issue.status === "in_review" ? "Pending Review" : issue.status.replace(/_/g, " ")}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function SearchPage() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const [searchParams] = useSearchParams();

  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [statusFilter, setStatusFilter] = useState("all");
  const [agentFilter, setAgentFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [dateRange, setDateRange] = useState("all");

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    setBreadcrumbs([{ label: "Search" }]);
  }, [setBreadcrumbs]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: projects } = useQuery({
    queryKey: queryKeys.projects.list(selectedCompanyId!),
    queryFn: () => projectsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const hasFilters = debouncedQuery || statusFilter !== "all" || agentFilter !== "all" || projectFilter !== "all";

  const { data: issues, isLoading } = useQuery({
    queryKey: [
      "search-page",
      selectedCompanyId,
      debouncedQuery,
      statusFilter,
      agentFilter,
      projectFilter,
    ],
    queryFn: () =>
      issuesApi.list(selectedCompanyId!, {
        q: debouncedQuery || undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        assigneeAgentId: agentFilter !== "all" ? agentFilter : undefined,
        projectId: projectFilter !== "all" ? projectFilter : undefined,
      }),
    enabled: !!selectedCompanyId && !!hasFilters,
  });

  const agentMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const a of agents ?? []) map[a.id] = a.name;
    return map;
  }, [agents]);

  const projectById = useMemo(() => {
    const map = new Map<string, { name: string; color?: string | null }>();
    for (const p of projects ?? []) map.set(p.id, p);
    return map;
  }, [projects]);

  const cutoff = cutoffFromRange(dateRange);
  const filteredIssues = useMemo((): Issue[] => {
    const list = issues ?? [];
    if (!cutoff) return list;
    return list.filter((i) => new Date(i.updatedAt) >= cutoff!);
  }, [issues, cutoff]);

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border px-4 py-3 flex flex-col gap-3">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Search issues, comments, deliverables…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 text-xs w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={agentFilter} onValueChange={setAgentFilter}>
            <SelectTrigger className="h-8 text-xs w-44">
              <SelectValue placeholder="Agent" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All agents</SelectItem>
              {(agents ?? []).map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="h-8 text-xs w-44">
              <SelectValue placeholder="Client / Project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              {(projects ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="h-8 text-xs w-36">
              <SelectValue placeholder="Date range" />
            </SelectTrigger>
            <SelectContent>
              {DATE_RANGES.map((r) => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {!hasFilters && (
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground">
            <SearchIcon className="h-8 w-8 opacity-30" />
            <p className="text-sm">Search issues, agent outputs, and comments</p>
            <p className="text-xs opacity-70">Try "Awoofi ad copy" or "property leads"</p>
          </div>
        )}

        {hasFilters && isLoading && <PageSkeleton />}

        {hasFilters && !isLoading && filteredIssues.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground">
            <CircleDot className="h-8 w-8 opacity-30" />
            <p className="text-sm">No results found</p>
            <p className="text-xs opacity-70">Try different keywords or remove some filters</p>
          </div>
        )}

        {hasFilters && !isLoading && filteredIssues.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground mb-1">
              {filteredIssues.length} result{filteredIssues.length !== 1 ? "s" : ""}
            </p>
            {filteredIssues.map((issue) => (
              <SearchResultCard
                key={issue.id}
                issue={issue}
                agentName={issue.assigneeAgentId ? agentMap[issue.assigneeAgentId] : undefined}
                project={issue.projectId ? projectById.get(issue.projectId) : undefined}
                query={debouncedQuery}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
