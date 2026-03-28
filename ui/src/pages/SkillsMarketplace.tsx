import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Puzzle, ChevronDown } from "lucide-react";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useToast } from "../context/ToastContext";
import { agentsApi } from "../api/agents";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "../lib/utils";
import { useEffect } from "react";

// Hardcoded openclaw skills catalog
const OPENCLAW_SKILLS = [
  {
    id: "ads",
    name: "ads",
    emoji: "📊",
    displayName: "Ads",
    description: "Paid advertising audit & optimization for Google, Meta, LinkedIn, TikTok, and more.",
    category: "Data",
  },
  {
    id: "weather",
    name: "weather",
    emoji: "🌤️",
    displayName: "Weather",
    description: "Get current weather conditions and forecasts for any location.",
    category: "Research",
  },
  {
    id: "gemini",
    name: "gemini",
    emoji: "✨",
    displayName: "Gemini",
    description: "Gemini CLI for one-shot Q&A, summaries, and AI generation tasks.",
    category: "Creative",
  },
  {
    id: "healthcheck",
    name: "healthcheck",
    emoji: "🔒",
    displayName: "Healthcheck",
    description: "Host security hardening and risk-tolerance configuration for OpenClaw deployments.",
    category: "Productivity",
  },
  {
    id: "tmux",
    name: "tmux",
    emoji: "💻",
    displayName: "Tmux",
    description: "Remote-control tmux sessions for interactive CLIs by sending keystrokes and scraping pane output.",
    category: "Productivity",
  },
  {
    id: "ui-ux-pro-max",
    name: "ui-ux-pro-max",
    emoji: "🎨",
    displayName: "UI/UX Pro Max",
    description: "AI-powered design intelligence for UI styles, color palettes, font pairings, and UX guidelines.",
    category: "Creative",
  },
  {
    id: "skill-creator",
    name: "skill-creator",
    emoji: "🛠️",
    displayName: "Skill Creator",
    description: "Create, edit, improve, or audit AgentSkills. Author new skills from scratch.",
    category: "Productivity",
  },
  {
    id: "coding-agent",
    name: "coding-agent",
    emoji: "🤖",
    displayName: "Coding Agent",
    description: "Delegate coding tasks to Codex, Claude Code, or Pi agents via background process.",
    category: "Productivity",
  },
  {
    id: "github",
    name: "github",
    emoji: "🐙",
    displayName: "GitHub",
    description: "GitHub operations via gh CLI: issues, PRs, CI runs, code review, and API queries.",
    category: "Productivity",
  },
  {
    id: "gh-issues",
    name: "gh-issues",
    emoji: "🔢",
    displayName: "GH Issues",
    description: "Fetch GitHub issues, spawn sub-agents to implement fixes and open PRs, then monitor review comments.",
    category: "Productivity",
  },
  {
    id: "gog",
    name: "gog",
    emoji: "📧",
    displayName: "Google Workspace",
    description: "Google Workspace CLI for Gmail, Calendar, Drive, Contacts, Sheets, and Docs.",
    category: "Communication",
  },
  {
    id: "video-frames",
    name: "video-frames",
    emoji: "🎬",
    displayName: "Video Frames",
    description: "Extract frames or short clips from videos using ffmpeg.",
    category: "Creative",
  },
];

const CATEGORIES = ["All", "Research", "Creative", "Data", "Communication", "Productivity"];

function SkillCard({
  skill,
  agents,
  companyId,
}: {
  skill: typeof OPENCLAW_SKILLS[0];
  agents: { id: string; name: string; urlKey: string }[];
  companyId: string | undefined;
}) {
  const [agentPickerOpen, setAgentPickerOpen] = useState(false);
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const addToAgent = useMutation({
    mutationFn: async (agentId: string) => {
      const agent = agents.find((a) => a.id === agentId);
      if (!agent) throw new Error("Agent not found");
      const snapshot = await agentsApi.skills(agentId, companyId);
      const existingKeys = snapshot.desiredSkills ?? [];
      if (existingKeys.includes(skill.name)) return snapshot;
      const next = [...existingKeys, skill.name];
      return agentsApi.syncSkills(agentId, next, companyId);
    },
    onSuccess: (_, agentId) => {
      const agent = agents.find((a) => a.id === agentId);
      pushToast({
        tone: "success",
        title: "Skill added",
        body: `${skill.displayName} added to ${agent?.name ?? "agent"}.`,
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.skills(agentId) });
      setAgentPickerOpen(false);
    },
    onError: (error) => {
      pushToast({
        tone: "error",
        title: "Failed to add skill",
        body: error instanceof Error ? error.message : "Unknown error",
      });
    },
  });

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none">{skill.emoji}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-sm text-foreground">{skill.displayName}</h3>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {skill.category}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{skill.description}</p>
        </div>
      </div>
      <div className="mt-auto pt-1">
        {agents.length === 0 ? (
          <Button size="sm" variant="outline" className="w-full text-xs" disabled>
            No agents available
          </Button>
        ) : (
          <Popover open={agentPickerOpen} onOpenChange={setAgentPickerOpen}>
            <PopoverTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="w-full text-xs gap-1"
                disabled={addToAgent.isPending}
              >
                {addToAgent.isPending ? "Adding..." : "Add to Agent"}
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-1" align="start">
              <div className="text-[11px] font-medium text-muted-foreground px-2 py-1 uppercase tracking-wide">
                Select agent
              </div>
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent/50 transition-colors"
                  onClick={() => addToAgent.mutate(agent.id)}
                  disabled={addToAgent.isPending}
                >
                  {agent.name}
                </button>
              ))}
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}

export function SkillsMarketplace() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  useEffect(() => {
    setBreadcrumbs([{ label: "Skills Marketplace" }]);
  }, [setBreadcrumbs]);

  const agentsQuery = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId ?? ""),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: Boolean(selectedCompanyId),
  });

  const filteredSkills = useMemo(() => {
    return OPENCLAW_SKILLS.filter((skill) => {
      const matchesSearch =
        searchQuery.trim().length === 0 ||
        skill.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        skill.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        skill.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory =
        selectedCategory === "All" || skill.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory]);

  const agents = agentsQuery.data ?? [];

  return (
    <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Puzzle className="h-7 w-7 text-muted-foreground mt-0.5 shrink-0" />
        <div>
          <h1 className="text-2xl font-semibold">Skills Marketplace</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Browse and install OpenClaw skills for your agents.
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search skills..."
          className="pl-9"
        />
      </div>

      {/* Category Filters */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((category) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={cn(
              "px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
              selectedCategory === category
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-foreground border-border hover:bg-accent/50",
            )}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Skills Grid */}
      {filteredSkills.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          No skills match your search.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredSkills.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              agents={agents}
              companyId={selectedCompanyId ?? undefined}
            />
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground pt-2">
        Showing {filteredSkills.length} of {OPENCLAW_SKILLS.length} available skills.
        Skills are sourced from <code>/usr/lib/node_modules/openclaw/skills/</code>.
      </p>
    </div>
  );
}
