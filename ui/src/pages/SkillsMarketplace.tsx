import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@/lib/router";
import type { CompanySkillListItem } from "@paperclipai/shared";
import type { AgentSkillSnapshot } from "@paperclipai/shared";
import { companySkillsApi } from "../api/companySkills";
import { agentsApi } from "../api/agents";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";
import { PageSkeleton } from "../components/PageSkeleton";
import { EmptyState } from "../components/EmptyState";
import {
  Boxes,
  Search,
  Github,
  Link2,
  Paperclip,
  HardDrive,
  ExternalLink,
  CheckCircle2,
  Circle,
  Users,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const CATEGORIES = ["All", "Research", "Creative", "Data", "Communication"] as const;
type Category = (typeof CATEGORIES)[number];

function getSkillCategory(skill: CompanySkillListItem): string {
  const meta = skill.metadata as Record<string, unknown> | null;
  return (meta?.category as string) || "Uncategorized";
}

function SourceBadge({ badge }: { badge: CompanySkillListItem["sourceBadge"] }) {
  if (badge === "github")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
        <Github className="h-2.5 w-2.5" /> GitHub
      </span>
    );
  if (badge === "paperclip")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400">
        <Paperclip className="h-2.5 w-2.5" /> Paperclip
      </span>
    );
  if (badge === "local")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
        <HardDrive className="h-2.5 w-2.5" /> Local
      </span>
    );
  if (badge === "url")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
        <Link2 className="h-2.5 w-2.5" /> URL
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
      <Boxes className="h-2.5 w-2.5" /> {badge}
    </span>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const colors: Record<string, string> = {
    Research: "bg-purple-500/10 text-purple-400",
    Creative: "bg-pink-500/10 text-pink-400",
    Data: "bg-cyan-500/10 text-cyan-400",
    Communication: "bg-green-500/10 text-green-400",
  };
  const cls = colors[category] ?? "bg-muted text-muted-foreground";
  return (
    <span className={cn("inline-flex text-[10px] px-1.5 py-0.5 rounded font-medium", cls)}>
      {category}
    </span>
  );
}

function AgentSelector({
  agents,
  selectedAgentId,
  onSelect,
}: {
  agents: { id: string; name: string; urlKey: string }[];
  selectedAgentId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = agents.find((a) => a.id === selectedAgentId);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-card text-sm hover:bg-accent/50 transition-colors min-w-[200px] justify-between"
      >
        <span className="truncate text-foreground">
          {selected ? selected.name : "Select an agent"}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-full min-w-[220px] rounded-lg border border-border bg-popover shadow-lg z-50 overflow-hidden">
          <button
            className="w-full text-left px-3 py-2 text-sm text-muted-foreground hover:bg-accent/50 transition-colors"
            onClick={() => { onSelect(null); setOpen(false); }}
          >
            None selected
          </button>
          {agents.map((a) => (
            <button
              key={a.id}
              className={cn(
                "w-full text-left px-3 py-2 text-sm hover:bg-accent/50 transition-colors",
                a.id === selectedAgentId && "bg-accent text-foreground",
              )}
              onClick={() => { onSelect(a.id); setOpen(false); }}
            >
              {a.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SkillCard({
  skill,
  isEquipped,
  canToggle,
  onToggle,
  toggling,
}: {
  skill: CompanySkillListItem;
  isEquipped: boolean;
  canToggle: boolean;
  onToggle: () => void;
  toggling: boolean;
}) {
  const category = getSkillCategory(skill);

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 flex flex-col gap-3 transition-colors",
        isEquipped ? "border-primary/30 bg-primary/5" : "border-border",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <SourceBadge badge={skill.sourceBadge} />
            {category !== "Uncategorized" && <CategoryBadge category={category} />}
          </div>
          <h3 className="text-sm font-semibold text-foreground truncate">{skill.name}</h3>
        </div>
        <button
          onClick={onToggle}
          disabled={!canToggle || toggling}
          title={
            !canToggle
              ? "Select an agent to equip this skill"
              : isEquipped
              ? "Unequip from agent"
              : "Equip for agent"
          }
          className={cn(
            "shrink-0 transition-colors",
            canToggle ? "cursor-pointer" : "cursor-default opacity-40",
            toggling && "opacity-50",
          )}
        >
          {isEquipped ? (
            <CheckCircle2 className="h-5 w-5 text-primary" />
          ) : (
            <Circle className="h-5 w-5 text-muted-foreground hover:text-foreground" />
          )}
        </button>
      </div>

      {skill.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {skill.description}
        </p>
      )}

      <div className="flex items-center justify-between mt-auto pt-1">
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Users className="h-3 w-3" />
          {skill.attachedAgentCount} agent{skill.attachedAgentCount !== 1 ? "s" : ""} equipped
        </span>
        <Link
          to={`/skills`}
          className="flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          Details <ExternalLink className="h-2.5 w-2.5 ml-0.5" />
        </Link>
      </div>
    </div>
  );
}

export function SkillsMarketplace() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id ?? "";
  const queryClient = useQueryClient();

  useBreadcrumbs([{ label: "Marketplace" }]);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category>("All");
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const { data: skills, isLoading: skillsLoading } = useQuery({
    queryKey: queryKeys.companySkills.list(companyId),
    queryFn: () => companySkillsApi.list(companyId),
    enabled: Boolean(companyId),
  });

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(companyId),
    queryFn: () => agentsApi.list(companyId),
    enabled: Boolean(companyId),
  });

  const { data: agentSkillSnapshot } = useQuery({
    queryKey: queryKeys.agents.skills(selectedAgentId ?? ""),
    queryFn: () => agentsApi.skills(selectedAgentId!, companyId),
    enabled: Boolean(selectedAgentId && companyId),
  });

  const syncSkillsMutation = useMutation({
    mutationFn: (desiredSkills: string[]) =>
      agentsApi.syncSkills(selectedAgentId!, desiredSkills, companyId),
    onSuccess: (snapshot: AgentSkillSnapshot) => {
      queryClient.setQueryData(queryKeys.agents.skills(selectedAgentId!), snapshot);
      queryClient.invalidateQueries({ queryKey: queryKeys.companySkills.list(companyId) });
    },
  });

  const equippedKeys = useMemo(
    () => new Set(agentSkillSnapshot?.desiredSkills ?? []),
    [agentSkillSnapshot],
  );

  const filteredSkills = useMemo(() => {
    if (!skills) return [];
    return skills.filter((s) => {
      const matchesSearch =
        !search ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        (s.description ?? "").toLowerCase().includes(search.toLowerCase());
      const skillCategory = getSkillCategory(s);
      const matchesCategory =
        category === "All" ||
        skillCategory.toLowerCase() === category.toLowerCase();
      return matchesSearch && matchesCategory;
    });
  }, [skills, search, category]);

  const activeAgents = useMemo(
    () => (agents ?? []).filter((a) => a.status === "active" || a.status === "paused"),
    [agents],
  );

  function handleToggle(skill: CompanySkillListItem) {
    if (!selectedAgentId || !agentSkillSnapshot) return;
    const current = [...(agentSkillSnapshot.desiredSkills ?? [])];
    const isEquipped = equippedKeys.has(skill.key);
    const next = isEquipped
      ? current.filter((k) => k !== skill.key)
      : [...current, skill.key];
    syncSkillsMutation.mutate(next);
  }

  if (skillsLoading) return <PageSkeleton />;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div>
          <h1 className="text-lg font-semibold">Skills Marketplace</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Browse and equip skills for your agents
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AgentSelector
            agents={activeAgents}
            selectedAgentId={selectedAgentId}
            onSelect={setSelectedAgentId}
          />
          {selectedAgentId && (
            <Link
              to={`/agents/${selectedAgentId}/skills`}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-2 hover:underline"
            >
              Open agent skills
            </Link>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border shrink-0">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search skills…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <div className="flex items-center gap-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={cn(
                "px-3 py-1 text-xs font-medium rounded-full transition-colors",
                category === cat
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Equip hint */}
      {!selectedAgentId && (
        <div className="mx-6 mt-3 px-3 py-2 rounded-lg bg-muted/50 border border-border text-xs text-muted-foreground">
          Select an agent above to equip or unequip skills with one click.
        </div>
      )}

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {filteredSkills.length === 0 ? (
          <EmptyState
            icon={Boxes}
            title={search || category !== "All" ? "No skills match your filter" : "No skills yet"}
            description={
              search || category !== "All"
                ? "Try adjusting your search or category filter."
                : "Import or create skills from the Skills Library."
            }
            action={
              <Button variant="outline" size="sm" asChild>
                <Link to="/skills">Go to Skills Library</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredSkills.map((skill) => (
              <SkillCard
                key={skill.id}
                skill={skill}
                isEquipped={equippedKeys.has(skill.key)}
                canToggle={Boolean(selectedAgentId && agentSkillSnapshot)}
                onToggle={() => handleToggle(skill)}
                toggling={syncSkillsMutation.isPending}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer stats */}
      <div className="px-6 py-2 border-t border-border shrink-0 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {filteredSkills.length} skill{filteredSkills.length !== 1 ? "s" : ""}
          {category !== "All" ? ` in ${category}` : ""}
          {search ? ` matching "${search}"` : ""}
        </span>
        {selectedAgentId && agentSkillSnapshot && (
          <span className="text-xs text-muted-foreground">
            {equippedKeys.size} equipped for {activeAgents.find((a) => a.id === selectedAgentId)?.name}
          </span>
        )}
      </div>
    </div>
  );
}
