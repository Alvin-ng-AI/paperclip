import React, { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Map, Lightbulb, Check, X, ArrowUp, ArrowDown, Minus, AlertTriangle } from "lucide-react";
import type { Issue } from "@paperclipai/shared";
import { roadmapApi, type RoadmapProposal } from "../api/roadmap";
import { issuesApi } from "../api/issues";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { useToast } from "../context/ToastContext";
import { PageSkeleton } from "../components/PageSkeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "../lib/utils";

// ── Priority helpers ──────────────────────────────────────────────────────────

const priorityConfig: Record<
  string,
  { icon: React.ElementType; className: string; label: string }
> = {
  critical: { icon: AlertTriangle, className: "text-red-500", label: "Critical" },
  high: { icon: ArrowUp, className: "text-orange-500", label: "High" },
  medium: { icon: Minus, className: "text-yellow-500", label: "Medium" },
  low: { icon: ArrowDown, className: "text-blue-400", label: "Low" },
};

const statusLabel: Record<string, string> = {
  in_progress: "In Progress",
  todo: "Todo",
  backlog: "Backlog",
  done: "Done",
  in_review: "In Review",
  blocked: "Blocked",
  cancelled: "Cancelled",
};

const statusColors: Record<string, string> = {
  in_progress: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  todo: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  backlog: "bg-muted text-muted-foreground",
  done: "bg-green-500/10 text-green-400 border-green-500/20",
  in_review: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  blocked: "bg-red-500/10 text-red-400 border-red-500/20",
  cancelled: "bg-muted text-muted-foreground line-through",
};

// ── Issue Card ────────────────────────────────────────────────────────────────

function IssueCard({ issue }: { issue: Issue }) {
  const cfg = priorityConfig[issue.priority] ?? priorityConfig.medium!;
  const PIcon = cfg.icon;
  const sColor = statusColors[issue.status] ?? statusColors.backlog!;

  return (
    <div className="rounded-lg border border-border bg-card p-3 flex flex-col gap-2 hover:border-border/80 hover:bg-accent/10 transition-colors">
      {/* Header row: identifier + priority icon */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-mono text-muted-foreground shrink-0">
          {issue.identifier ?? `#${issue.issueNumber ?? "?"}`}
        </span>
        <span className={cn("flex items-center gap-1 text-[11px] font-medium shrink-0", cfg.className)}>
          <PIcon className="h-3 w-3" />
          {cfg.label}
        </span>
      </div>

      {/* Title */}
      <p className="text-sm font-medium text-foreground leading-snug line-clamp-2">
        {issue.title}
      </p>

      {/* Description */}
      {issue.description && (
        <p className="text-[12px] text-muted-foreground leading-relaxed line-clamp-2">
          {issue.description}
        </p>
      )}

      {/* Footer: status chip + assignee */}
      <div className="flex items-center justify-between gap-2 mt-1">
        <span
          className={cn(
            "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border",
            sColor,
          )}
        >
          {statusLabel[issue.status] ?? issue.status}
        </span>
        {issue.assigneeAgentId && (
          <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">
            {/* agent name not available in list view, show short ID */}
            agent
          </span>
        )}
      </div>
    </div>
  );
}

// ── Column ────────────────────────────────────────────────────────────────────

interface ColumnProps {
  title: string;
  colorClass: string;
  issues: Issue[];
}

function RoadmapColumn({ title, colorClass, issues }: ColumnProps) {
  return (
    <div className="flex-1 min-w-0 flex flex-col gap-3">
      {/* Column header */}
      <div className="flex items-center gap-2 px-1">
        <span className={cn("w-2 h-2 rounded-full shrink-0", colorClass)} />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <span className="ml-auto text-xs text-muted-foreground">{issues.length}</span>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2">
        {issues.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/50 p-4 text-center">
            <p className="text-[12px] text-muted-foreground">No items</p>
          </div>
        ) : (
          issues.map((issue) => <IssueCard key={issue.id} issue={issue} />)
        )}
      </div>
    </div>
  );
}

// ── Proposal Card ─────────────────────────────────────────────────────────────

interface ProposalCardProps {
  proposal: RoadmapProposal;
  companyId: string;
  onDismiss: (id: string) => void;
}

function ProposalCard({ proposal, companyId, onDismiss }: ProposalCardProps) {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const approveMutation = useMutation({
    mutationFn: () =>
      issuesApi.create(companyId, {
        title: proposal.title,
        description: proposal.description,
        status: "backlog",
        priority: "medium",
      }),
    onSuccess: () => {
      pushToast({ title: `"${proposal.title}" added to issues`, tone: "success" });
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.list(companyId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.roadmap(companyId) });
      onDismiss(proposal.id);
    },
    onError: () => {
      pushToast({ title: "Failed to create issue", tone: "error" });
    },
  });

  return (
    <div className="rounded-lg border border-border bg-card p-3 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{proposal.title}</p>
          {proposal.description && (
            <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">
              {proposal.description}
            </p>
          )}
          <p className="text-[10px] text-muted-foreground/60 mt-1">{proposal.source}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            size="icon-sm"
            variant="ghost"
            className="h-7 w-7 text-green-500 hover:text-green-400 hover:bg-green-500/10"
            onClick={() => approveMutation.mutate()}
            disabled={approveMutation.isPending}
            title="Approve — create issue"
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
            onClick={() => onDismiss(proposal.id)}
            title="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function Roadmap() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([{ label: "Roadmap" }]);
  }, [setBreadcrumbs]);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.roadmap(selectedCompanyId!),
    queryFn: () => roadmapApi.get(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  // Local dismiss state for proposals
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const handleDismiss = (id: string) => setDismissed((prev) => new Set([...prev, id]));

  const visibleProposals = (data?.proposals ?? []).filter((p) => !dismissed.has(p.id));

  if (isLoading) return <PageSkeleton variant="list" />;

  if (error) {
    return (
      <div className="p-6 text-sm text-destructive">
        Failed to load roadmap. Make sure the CLAWD OS project exists.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto w-full">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted">
          <Map className="h-4 w-4 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-foreground">Roadmap</h1>
          <p className="text-[12px] text-muted-foreground">CLAWD OS platform — Now / Next / Later</p>
        </div>
      </div>

      {/* Kanban board */}
      <div className="flex gap-4 items-start">
        <RoadmapColumn
          title="Now"
          colorClass="bg-indigo-500"
          issues={data?.now ?? []}
        />
        <RoadmapColumn
          title="Next"
          colorClass="bg-amber-500"
          issues={data?.next ?? []}
        />
        <RoadmapColumn
          title="Later"
          colorClass="bg-muted-foreground"
          issues={data?.later ?? []}
        />
      </div>

      {/* Proposals section */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-yellow-400 shrink-0" />
          <h2 className="text-sm font-semibold text-foreground">
            💡 Proposed from Alvin&apos;s Feedback
          </h2>
          {visibleProposals.length > 0 && (
            <Badge variant="outline" className="ml-1 text-[10px]">
              {visibleProposals.length}
            </Badge>
          )}
        </div>

        {visibleProposals.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/50 p-6 text-center">
            <Lightbulb className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-[12px] text-muted-foreground">
              No pending proposals. Feedback-driven suggestions will appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {visibleProposals.map((p) => (
              <ProposalCard
                key={p.id}
                proposal={p}
                companyId={selectedCompanyId!}
                onDismiss={handleDismiss}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

