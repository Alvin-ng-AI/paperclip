import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@/lib/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { dashboardApi } from "../api/dashboard";
import { issuesApi } from "../api/issues";
import { agentsApi } from "../api/agents";
import { useCompany } from "../context/CompanyContext";
import { useDialog } from "../context/DialogContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useToast } from "../context/ToastContext";
import { queryKeys } from "../lib/queryKeys";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { timeAgo } from "../lib/timeAgo";
import { LayoutDashboard, Bell, Plus, ChevronRight, Check, X, MessageSquare, Ban } from "lucide-react";
import type { Agent, Issue } from "@paperclipai/shared";
import { AGENT_ROLE_LABELS } from "@paperclipai/shared";
import { agentUrl } from "../lib/utils";

// ── Agent status helpers ─────────────────────────────────────────────────────

type AgentDisplayStatus = "working" | "blocked" | "error" | "idle";

function getAgentDisplayStatus(status: string): AgentDisplayStatus {
  if (status === "running") return "working";
  if (status === "error") return "error";
  if (status === "paused") return "blocked";
  return "idle";
}

const STATUS_DOT: Record<AgentDisplayStatus, { bg: string; shadow?: string }> = {
  working: { bg: "#818CF8", shadow: "0 0 6px #818CF8" },
  error:   { bg: "#EF4444", shadow: "0 0 6px #EF4444" },
  blocked: { bg: "#F59E0B" },
  idle:    { bg: "#374151" },
};

const STATUS_BADGE: Record<AgentDisplayStatus, { label: string; bg: string; color: string }> = {
  working: { label: "Working", bg: "rgba(99,102,241,0.15)", color: "#818CF8" },
  error:   { label: "Error",   bg: "rgba(239,68,68,0.15)",  color: "#EF4444" },
  blocked: { label: "Blocked", bg: "rgba(245,158,11,0.15)", color: "#F59E0B" },
  idle:    { label: "Idle",    bg: "rgba(255,255,255,0.04)", color: "#4B5563" },
};

function sortAgents(agents: Agent[]): Agent[] {
  const order: Record<string, number> = { running: 0, error: 1, paused: 2, active: 3 };
  return [...agents]
    .filter((a) => a.status !== "terminated")
    .sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9));
}

// ── Per-card action state ─────────────────────────────────────────────────────

type CardMode = null | "reject" | "comment" | "cancel" | "resolve";

interface CardState {
  mode: CardMode;
  text: string;
}

// ── KPI card data ────────────────────────────────────────────────────────────

interface KpiCard {
  label: string;
  count: number;
  color: string;
  sub: string;
  subColor: string;
  to?: string;
}

// ── Main component ───────────────────────────────────────────────────────────

export function Dashboard() {
  const { selectedCompanyId, companies } = useCompany();
  const { openOnboarding, openNewIssue } = useDialog();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Per-card expanded action state
  const [cardStates, setCardStates] = useState<Record<string, CardState>>({});

  const setCardMode = (issueId: string, mode: CardMode) =>
    setCardStates((prev) => ({ ...prev, [issueId]: { mode, text: prev[issueId]?.text ?? "" } }));
  const setCardText = (issueId: string, text: string) =>
    setCardStates((prev) => ({ ...prev, [issueId]: { mode: prev[issueId]?.mode ?? null, text } }));
  const clearCard = (issueId: string) =>
    setCardStates((prev) => { const n = { ...prev }; delete n[issueId]; return n; });

  useEffect(() => {
    setBreadcrumbs([{ label: "Dashboard" }]);
  }, [setBreadcrumbs]);

  const { data: summary, isLoading } = useQuery({
    queryKey: queryKeys.dashboard(selectedCompanyId!),
    queryFn: () => dashboardApi.summary(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: reviewIssues } = useQuery({
    queryKey: [...queryKeys.issues.list(selectedCompanyId!), "in_review"],
    queryFn: () => issuesApi.list(selectedCompanyId!, { status: "in_review" }),
    enabled: !!selectedCompanyId,
  });

  const { data: blockedIssues } = useQuery({
    queryKey: [...queryKeys.issues.list(selectedCompanyId!), "blocked"],
    queryFn: () => issuesApi.list(selectedCompanyId!, { status: "blocked" }),
    enabled: !!selectedCompanyId,
  });

  const { data: inProgressIssues } = useQuery({
    queryKey: [...queryKeys.issues.list(selectedCompanyId!), "in_progress"],
    queryFn: () => issuesApi.list(selectedCompanyId!, { status: "in_progress" }),
    enabled: !!selectedCompanyId,
  });

  const agentMap = useMemo(() => {
    const m = new Map<string, Agent>();
    for (const a of agents ?? []) m.set(a.id, a);
    return m;
  }, [agents]);

  const agentTaskMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const issue of inProgressIssues ?? []) {
      if (issue.assigneeAgentId && !m.has(issue.assigneeAgentId)) {
        m.set(issue.assigneeAgentId, issue.title);
      }
    }
    return m;
  }, [inProgressIssues]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.issues.list(selectedCompanyId!) });
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(selectedCompanyId!) });
  };

  const approveMutation = useMutation({
    mutationFn: (issueId: string) => issuesApi.update(issueId, { status: "done" }),
    onSuccess: (_d, issueId) => { clearCard(issueId); invalidate(); pushToast({ title: "Approved ✓", tone: "success" }); },
    onError: () => pushToast({ title: "Approval failed", tone: "error" }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ issueId, reason }: { issueId: string; reason: string }) =>
      issuesApi.addComment(issueId, `❌ Rejected: ${reason}`, true /* reopen */),
    onSuccess: (_d, { issueId }) => { clearCard(issueId); invalidate(); pushToast({ title: "Sent back to agent", tone: "success" }); },
    onError: () => pushToast({ title: "Reject failed", tone: "error" }),
  });

  const commentMutation = useMutation({
    mutationFn: ({ issueId, body }: { issueId: string; body: string }) =>
      issuesApi.addComment(issueId, body),
    onSuccess: (_d, { issueId }) => { clearCard(issueId); pushToast({ title: "Comment added", tone: "success" }); },
    onError: () => pushToast({ title: "Comment failed", tone: "error" }),
  });

  const cancelMutation = useMutation({
    mutationFn: (issueId: string) => issuesApi.update(issueId, { status: "cancelled" }),
    onSuccess: (_d, issueId) => { clearCard(issueId); invalidate(); pushToast({ title: "Task cancelled", tone: "success" }); },
    onError: () => pushToast({ title: "Cancel failed", tone: "error" }),
  });

  // Resolve a blocked task: add comment with the info needed, move back to in_progress
  const resolveMutation = useMutation({
    mutationFn: ({ issueId, body }: { issueId: string; body: string }) =>
      issuesApi.addComment(issueId, `✅ Resolved by Alvin: ${body}`, true /* reopen */),
    onSuccess: (_d, { issueId }) => { clearCard(issueId); invalidate(); pushToast({ title: "Unblocked — agent will resume", tone: "success" }); },
    onError: () => pushToast({ title: "Failed to unblock", tone: "error" }),
  });

  // Guard: no company selected
  if (!selectedCompanyId) {
    if (companies.length === 0) {
      return (
        <EmptyState
          icon={LayoutDashboard}
          message="Welcome to Paperclip. Set up your first company and agent to get started."
          action="Get Started"
          onAction={openOnboarding}
        />
      );
    }
    return (
      <EmptyState icon={LayoutDashboard} message="Create or select a company to view the dashboard." />
    );
  }

  if (isLoading) {
    return <PageSkeleton variant="dashboard" />;
  }

  // KPI cards — derived from summary
  const kpiCards: KpiCard[] = [
    {
      label: "Active",
      count: summary?.tasks.inProgress ?? 0,
      color: "#818CF8",
      sub: summary && summary.tasks.inProgress > 0 ? `↑ ${summary.tasks.inProgress} running` : "none running",
      subColor: summary && summary.tasks.inProgress > 0 ? "#22C55E" : "#6B7280",
      to: "/issues?status=in_progress",
    },
    {
      label: "In Review",
      count: reviewIssues?.length ?? summary?.pendingApprovals ?? 0,
      color: "#FBB724",
      sub: "needs you",
      subColor: "#F59E0B",
      to: "/issues?status=in_review",
    },
    {
      label: "Done",
      count: summary?.tasks.done ?? 0,
      color: "#22C55E",
      sub: summary && summary.tasks.done > 0 ? `↑ total` : "none yet",
      subColor: "#22C55E",
      to: "/issues?status=done",
    },
    {
      label: "Blocked",
      count: summary?.tasks.blocked ?? 0,
      color: "#EF4444",
      sub: summary && summary.tasks.blocked > 0 ? "needs action" : "all clear",
      subColor: summary && summary.tasks.blocked > 0 ? "#EF4444" : "#22C55E",
      to: "/issues?status=blocked",
    },
  ];

  const sortedAgents = sortAgents(agents ?? []);
  const displayAgents = sortedAgents.slice(0, 5);
  const approvalIssues = reviewIssues ?? [];

  return (
    // Break out of the layout's p-4 md:p-6 padding
    <div
      className="-mx-4 -mt-4 md:-mx-6 md:-mt-6 min-h-full"
      style={{ background: "#070B14", color: "#fff" }}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ background: "#070B14", borderColor: "rgba(255,255,255,0.05)" }}
      >
        <div className="text-lg font-extrabold tracking-tight">
          CLAWD <span style={{ color: "#6366F1" }}>OS</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => openNewIssue()}
            className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full"
            style={{
              background: "rgba(99,102,241,0.15)",
              border: "1px solid rgba(99,102,241,0.3)",
              color: "#6366F1",
            }}
          >
            <Plus className="h-3 w-3" />
            New Task
          </button>
          <Bell className="h-5 w-5" style={{ color: "#4B5563" }} />
        </div>
      </div>

      {/* ── KPI Strip ──────────────────────────────────────────────────── */}
      <div className="flex gap-2 px-4 py-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {kpiCards.map((card) => {
          const cardContent = (
            <>
              <div className="text-[22px] font-extrabold" style={{ color: card.color }}>
                {card.count}
              </div>
              <div
                className="text-[10px] mt-0.5 uppercase tracking-wider"
                style={{ color: "#6B7280" }}
              >
                {card.label}
              </div>
              <div className="text-[10px] mt-1" style={{ color: card.subColor }}>
                {card.sub}
              </div>
            </>
          );
          const cardStyle = {
            background: "#0D1220",
            border: "1px solid rgba(255,255,255,0.06)",
            minWidth: "100px",
          };
          const cardClass = "flex-shrink-0 rounded-xl p-3 transition-opacity hover:opacity-80";
          return card.to ? (
            <Link
              key={card.label}
              to={card.to}
              className={`${cardClass} no-underline text-inherit`}
              style={cardStyle}
            >
              {cardContent}
            </Link>
          ) : (
            <div key={card.label} className={cardClass} style={cardStyle}>
              {cardContent}
            </div>
          );
        })}
      </div>

      {/* ── Team Status ────────────────────────────────────────────────── */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <span
          className="text-xs font-bold uppercase tracking-widest"
          style={{ color: "#4B5563" }}
        >
          Team Status
        </span>
        <Link
          to="/agents/all"
          className="text-xs font-semibold flex items-center gap-0.5 no-underline"
          style={{ color: "#6366F1" }}
        >
          See all <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      {displayAgents.length === 0 ? (
        <p className="px-4 py-2 text-sm" style={{ color: "#4B5563" }}>
          No agents yet.{" "}
          <button
            className="underline"
            style={{ color: "#6366F1" }}
            onClick={() => openOnboarding({ initialStep: 2, companyId: selectedCompanyId })}
          >
            Create one
          </button>
        </p>
      ) : (
        displayAgents.map((agent) => {
          const ds = getAgentDisplayStatus(agent.status);
          const dot = STATUS_DOT[ds];
          const badge = STATUS_BADGE[ds];
          const roleLabel = AGENT_ROLE_LABELS[agent.role] ?? agent.role;
          const currentTask = agentTaskMap.get(agent.id);
          return (
            <Link
              key={agent.id}
              to={agentUrl(agent)}
              className="flex items-center gap-2.5 px-4 py-2 no-underline text-inherit transition-colors hover:bg-white/[0.03]"
            >
              <div
                className="w-2 h-2 rounded-full flex-shrink-0 mt-0.5"
                style={{ background: dot.bg, boxShadow: dot.shadow }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{agent.name}</div>
                {ds === "working" && currentTask ? (
                  <div className="text-[11px] truncate" style={{ color: "#818CF8" }}>
                    {currentTask}
                  </div>
                ) : (
                  <div className="text-[11px] truncate" style={{ color: "#6B7280" }}>
                    {agent.title ?? roleLabel}
                  </div>
                )}
              </div>
              <div
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                style={{ background: badge.bg, color: badge.color }}
              >
                {badge.label}
              </div>
            </Link>
          );
        })
      )}

      {/* ── Needs Your Approval ────────────────────────────────────────── */}
      <div className="px-4 pt-4 pb-2">
        <span
          className="text-xs font-bold uppercase tracking-widest"
          style={{ color: "#4B5563" }}
        >
          Needs Your Approval
        </span>
      </div>

      {approvalIssues.length === 0 ? (
        <div
          className="mx-4 rounded-xl p-4 text-sm"
          style={{
            background: "#0D1220",
            border: "1px solid rgba(255,255,255,0.06)",
            color: "#4B5563",
          }}
        >
          All clear — no items waiting for approval.
        </div>
      ) : (
        approvalIssues.map((issue: Issue) => {
          const assignee = issue.assigneeAgentId ? agentMap.get(issue.assigneeAgentId) : null;
          const roleLabel = assignee
            ? (AGENT_ROLE_LABELS[assignee.role] ?? assignee.role)
            : null;
          const issueId = issue.identifier ?? issue.id.slice(0, 8).toUpperCase();
          const cs = cardStates[issue.id] ?? { mode: null, text: "" };
          const anyPending =
            approveMutation.isPending ||
            rejectMutation.isPending ||
            commentMutation.isPending ||
            cancelMutation.isPending;

          return (
            <div
              key={issue.id}
              className="mx-4 mb-2 rounded-xl p-3"
              style={{
                background: "#0D1220",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              {/* Top row: ID badge + status badge */}
              <div className="flex items-center justify-between mb-1.5">
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{
                    background: "rgba(99,102,241,0.1)",
                    color: "#6366F1",
                  }}
                >
                  {issueId}
                </span>
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    background: "rgba(251,191,36,0.15)",
                    color: "#FBB724",
                  }}
                >
                  IN REVIEW
                </span>
              </div>

              {/* Title */}
              <p className="text-[13px] font-semibold mb-1 line-clamp-2">{issue.title}</p>

              {/* Agent + time */}
              <p className="text-[11px]" style={{ color: "#6B7280" }}>
                {assignee ? (
                  <>
                    👤 {assignee.name}
                    {roleLabel && <span> · {roleLabel}</span>}
                    {" · "}
                  </>
                ) : null}
                {timeAgo(issue.updatedAt)}
              </p>

              {/* ── Expanded: Reject input ── */}
              {cs.mode === "reject" && (
                <div className="mt-2">
                  <textarea
                    className="w-full rounded-lg p-2 text-xs resize-none"
                    style={{
                      background: "rgba(239,68,68,0.08)",
                      border: "1px solid rgba(239,68,68,0.3)",
                      color: "#fff",
                      outline: "none",
                    }}
                    rows={2}
                    placeholder="Why are you rejecting this?"
                    value={cs.text}
                    onChange={(e) => setCardText(issue.id, e.target.value)}
                    autoFocus
                  />
                  <div className="flex gap-2 mt-1.5">
                    <button
                      className="flex-1 text-xs font-semibold py-1.5 rounded-lg"
                      style={{
                        background: "rgba(239,68,68,0.15)",
                        border: "1px solid rgba(239,68,68,0.3)",
                        color: "#EF4444",
                      }}
                      disabled={anyPending || !cs.text.trim()}
                      onClick={() => rejectMutation.mutate({ issueId: issue.id, reason: cs.text })}
                    >
                      Send & Reject
                    </button>
                    <button
                      className="px-3 text-xs rounded-lg"
                      style={{ background: "rgba(255,255,255,0.05)", color: "#6B7280" }}
                      onClick={() => clearCard(issue.id)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* ── Expanded: Comment input ── */}
              {cs.mode === "comment" && (
                <div className="mt-2">
                  <textarea
                    className="w-full rounded-lg p-2 text-xs resize-none"
                    style={{
                      background: "rgba(99,102,241,0.08)",
                      border: "1px solid rgba(99,102,241,0.3)",
                      color: "#fff",
                      outline: "none",
                    }}
                    rows={2}
                    placeholder="Add a comment without changing status…"
                    value={cs.text}
                    onChange={(e) => setCardText(issue.id, e.target.value)}
                    autoFocus
                  />
                  <div className="flex gap-2 mt-1.5">
                    <button
                      className="flex-1 text-xs font-semibold py-1.5 rounded-lg"
                      style={{
                        background: "rgba(99,102,241,0.15)",
                        border: "1px solid rgba(99,102,241,0.3)",
                        color: "#818CF8",
                      }}
                      disabled={anyPending || !cs.text.trim()}
                      onClick={() => commentMutation.mutate({ issueId: issue.id, body: cs.text })}
                    >
                      Add Comment
                    </button>
                    <button
                      className="px-3 text-xs rounded-lg"
                      style={{ background: "rgba(255,255,255,0.05)", color: "#6B7280" }}
                      onClick={() => clearCard(issue.id)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* ── Expanded: Cancel confirmation ── */}
              {cs.mode === "cancel" && (
                <div
                  className="mt-2 rounded-lg p-2.5"
                  style={{
                    background: "rgba(239,68,68,0.08)",
                    border: "1px solid rgba(239,68,68,0.2)",
                  }}
                >
                  <p className="text-xs mb-2" style={{ color: "#FCA5A5" }}>
                    Cancel this task? This cannot be undone.
                  </p>
                  <div className="flex gap-2">
                    <button
                      className="flex-1 text-xs font-semibold py-1.5 rounded-lg"
                      style={{
                        background: "rgba(239,68,68,0.2)",
                        border: "1px solid rgba(239,68,68,0.4)",
                        color: "#EF4444",
                      }}
                      disabled={anyPending}
                      onClick={() => cancelMutation.mutate(issue.id)}
                    >
                      Yes, cancel task
                    </button>
                    <button
                      className="px-3 text-xs rounded-lg"
                      style={{ background: "rgba(255,255,255,0.05)", color: "#6B7280" }}
                      onClick={() => clearCard(issue.id)}
                    >
                      Back
                    </button>
                  </div>
                </div>
              )}

              {/* ── Actions row (always visible unless expanded) ── */}
              {cs.mode === null && (
                <div className="grid grid-cols-2 gap-1.5 mt-2.5">
                  {/* Approve */}
                  <button
                    className="flex items-center justify-center gap-1 text-xs font-semibold py-1.5 rounded-lg"
                    style={{
                      background: "rgba(34,197,94,0.15)",
                      border: "1px solid rgba(34,197,94,0.3)",
                      color: "#22C55E",
                    }}
                    disabled={anyPending}
                    onClick={() => approveMutation.mutate(issue.id)}
                  >
                    <Check className="h-3 w-3" />
                    Approve
                  </button>

                  {/* Reject */}
                  <button
                    className="flex items-center justify-center gap-1 text-xs font-semibold py-1.5 rounded-lg"
                    style={{
                      background: "rgba(239,68,68,0.1)",
                      border: "1px solid rgba(239,68,68,0.25)",
                      color: "#EF4444",
                    }}
                    disabled={anyPending}
                    onClick={() => setCardMode(issue.id, "reject")}
                  >
                    <X className="h-3 w-3" />
                    Reject
                  </button>

                  {/* Comment */}
                  <button
                    className="flex items-center justify-center gap-1 text-xs font-semibold py-1.5 rounded-lg"
                    style={{
                      background: "rgba(99,102,241,0.1)",
                      border: "1px solid rgba(99,102,241,0.2)",
                      color: "#818CF8",
                    }}
                    disabled={anyPending}
                    onClick={() => setCardMode(issue.id, "comment")}
                  >
                    <MessageSquare className="h-3 w-3" />
                    Comment
                  </button>

                  {/* View Details */}
                  <button
                    className="flex items-center justify-center gap-1 text-xs font-semibold py-1.5 rounded-lg"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "#9CA3AF",
                    }}
                    onClick={() => navigate(`/issues/${issue.identifier ?? issue.id}`)}
                  >
                    View Details
                  </button>

                  {/* Cancel task — full width */}
                  <button
                    className="col-span-2 flex items-center justify-center gap-1 text-[11px] font-medium py-1 rounded-lg"
                    style={{
                      background: "rgba(239,68,68,0.05)",
                      border: "1px solid rgba(239,68,68,0.12)",
                      color: "#6B7280",
                    }}
                    disabled={anyPending}
                    onClick={() => setCardMode(issue.id, "cancel")}
                  >
                    <Ban className="h-3 w-3" />
                    Cancel task
                  </button>
                </div>
              )}
            </div>
          );
        })
      )}

      {/* ── Blocked — Needs Your Input ─────────────────────────────── */}
      {(blockedIssues?.length ?? 0) > 0 && (
        <>
          <div className="px-4 pt-4 pb-2">
            <span
              className="text-xs font-bold uppercase tracking-widest"
              style={{ color: "#4B5563" }}
            >
              Blocked — Needs Your Input
            </span>
          </div>

          {(blockedIssues ?? []).map((issue: Issue) => {
            const assignee = issue.assigneeAgentId ? agentMap.get(issue.assigneeAgentId) : null;
            const issueId = issue.identifier ?? issue.id.slice(0, 8).toUpperCase();
            const cs = cardStates[issue.id] ?? { mode: null, text: "" };
            return (
              <div
                key={issue.id}
                className="mx-4 mb-2 rounded-xl p-3"
                style={{
                  background: "#0D1220",
                  border: "1px solid rgba(239,68,68,0.2)",
                }}
              >
                {/* Top row */}
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(239,68,68,0.1)", color: "#EF4444" }}
                  >
                    {issueId}
                  </span>
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(239,68,68,0.15)", color: "#EF4444" }}
                  >
                    BLOCKED
                  </span>
                </div>
                {/* Title */}
                <p className="text-[13px] font-semibold mb-1 line-clamp-2">{issue.title}</p>
                {/* Agent + time */}
                <p className="text-[11px]" style={{ color: "#6B7280" }}>
                  {assignee ? <>👤 {assignee.name} · </> : null}
                  {timeAgo(issue.updatedAt)}
                </p>

                {/* Resolve input */}
                {cs.mode === "resolve" && (
                  <div className="mt-2">
                    <textarea
                      className="w-full rounded-lg p-2 text-xs resize-none"
                      style={{
                        background: "rgba(34,197,94,0.06)",
                        border: "1px solid rgba(34,197,94,0.3)",
                        color: "#fff",
                        outline: "none",
                      }}
                      rows={2}
                      placeholder="Provide the info needed to unblock this…"
                      value={cs.text}
                      onChange={(e) => setCardText(issue.id, e.target.value)}
                      autoFocus
                    />
                    <div className="flex gap-2 mt-1.5">
                      <button
                        className="flex-1 text-xs font-semibold py-1.5 rounded-lg"
                        style={{
                          background: "rgba(34,197,94,0.15)",
                          border: "1px solid rgba(34,197,94,0.3)",
                          color: "#22C55E",
                        }}
                        disabled={resolveMutation.isPending || !cs.text.trim()}
                        onClick={() => resolveMutation.mutate({ issueId: issue.id, body: cs.text })}
                      >
                        Unblock
                      </button>
                      <button
                        className="px-3 text-xs rounded-lg"
                        style={{ background: "rgba(255,255,255,0.05)", color: "#6B7280" }}
                        onClick={() => clearCard(issue.id)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Actions */}
                {cs.mode === null && (
                  <div className="flex gap-2 mt-2.5">
                    <button
                      className="flex-1 text-xs font-semibold py-1.5 rounded-lg"
                      style={{
                        background: "rgba(34,197,94,0.12)",
                        border: "1px solid rgba(34,197,94,0.3)",
                        color: "#22C55E",
                      }}
                      onClick={() => setCardMode(issue.id, "resolve")}
                    >
                      → Resolve
                    </button>
                    <button
                      className="flex-1 text-xs font-semibold py-1.5 rounded-lg"
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        color: "#9CA3AF",
                      }}
                      onClick={() => navigate(`/issues/${issue.identifier ?? issue.id}`)}
                    >
                      View Details
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {/* Bottom padding so content clears the mobile bottom nav */}
      <div className="h-24" />
    </div>
  );
}
