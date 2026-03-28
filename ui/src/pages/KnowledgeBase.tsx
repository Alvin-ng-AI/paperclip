import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@/lib/router";
import { BookOpen, ChevronDown, ChevronRight, FileText, Plus, Search } from "lucide-react";
import { documentsApi, type CompanyDocument } from "../api/documents";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "../lib/utils";
import { cn } from "../lib/utils";

// Fixed document IDs to surface in Awoofi section
const AWOOFI_DOC_IDS = new Set([
  "a9fd417e-8a77-48b4-852c-61858bb9cdef",
  "7bf914fb-df2e-4aae-b349-a4b0e99b285d",
]);

interface DocGroup {
  groupKey: string;
  label: string;
  docs: CompanyDocument[];
  kind: "client" | "agency";
}

function DocRow({ doc, companyPrefix }: { doc: CompanyDocument; companyPrefix: string }) {
  const navigate = useNavigate();
  const title = doc.title || doc.key || "Untitled";

  function openDoc() {
    if (doc.issueId) {
      navigate(`/${companyPrefix}/issues/${doc.issueId}`);
    }
  }

  return (
    <button
      onClick={openDoc}
      className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-accent/50 transition-colors group"
    >
      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <span className="text-sm text-foreground truncate block">{title}</span>
        {doc.issueTitle && doc.issueTitle !== title && (
          <span className="text-xs text-muted-foreground truncate block">
            {doc.issueIdentifier ? `${doc.issueIdentifier} · ` : ""}{doc.issueTitle}
          </span>
        )}
      </div>
      <span className="text-xs text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {formatDate(doc.updatedAt)}
      </span>
    </button>
  );
}

function SectionGroup({
  label,
  docs,
  companyPrefix,
  defaultOpen = true,
  onNewDoc,
}: {
  label: string;
  docs: CompanyDocument[];
  companyPrefix: string;
  defaultOpen?: boolean;
  onNewDoc?: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-accent/30 transition-colors"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <span className="flex-1 text-sm font-semibold text-foreground text-left">{label}</span>
        <span className="text-xs text-muted-foreground">{docs.length} doc{docs.length !== 1 ? "s" : ""}</span>
      </button>

      {open && (
        <div className="border-t border-border">
          {docs.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">No documents yet.</p>
          ) : (
            <div className="divide-y divide-border/50">
              {docs.map((doc) => (
                <DocRow key={doc.id} doc={doc} companyPrefix={companyPrefix} />
              ))}
            </div>
          )}
          {onNewDoc && (
            <div className="border-t border-border/50 px-4 py-2">
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={onNewDoc}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                New Doc
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function KnowledgeBase() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const [search, setSearch] = useState("");

  useEffect(() => {
    setBreadcrumbs([{ label: "Knowledge Base" }]);
  }, [setBreadcrumbs]);

  const { data: allDocs, isLoading, error } = useQuery({
    queryKey: queryKeys.documents.listForCompany(selectedCompanyId!),
    queryFn: () => documentsApi.listForCompany(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const companyPrefix = selectedCompany?.issuePrefix ?? "";

  const filtered = useMemo(() => {
    if (!allDocs) return [];
    if (!search.trim()) return allDocs;
    const q = search.toLowerCase();
    return allDocs.filter(
      (doc) =>
        (doc.title ?? "").toLowerCase().includes(q) ||
        (doc.key ?? "").toLowerCase().includes(q) ||
        (doc.issueTitle ?? "").toLowerCase().includes(q) ||
        (doc.projectName ?? "").toLowerCase().includes(q),
    );
  }, [allDocs, search]);

  // Group: Awoofi (fixed docs) vs other projects vs uncategorized
  const groups = useMemo((): { clients: DocGroup[]; agency: DocGroup[] } => {
    const awoofiDocs: CompanyDocument[] = [];
    const byProject = new Map<string, { name: string; docs: CompanyDocument[] }>();
    const noProjectDocs: CompanyDocument[] = [];

    for (const doc of filtered) {
      // Awoofi — pinned IDs
      if (AWOOFI_DOC_IDS.has(doc.id)) {
        awoofiDocs.push(doc);
        continue;
      }

      if (doc.projectId && doc.projectName) {
        if (!byProject.has(doc.projectId)) {
          byProject.set(doc.projectId, { name: doc.projectName, docs: [] });
        }
        byProject.get(doc.projectId)!.docs.push(doc);
      } else {
        noProjectDocs.push(doc);
      }
    }

    const clientGroups: DocGroup[] = [
      {
        groupKey: "awoofi",
        label: "Awoofi",
        docs: awoofiDocs,
        kind: "client",
      },
      ...Array.from(byProject.entries())
        .filter(([key]) => key !== "awoofi")
        .map(([key, { name, docs }]): DocGroup => ({
          groupKey: key,
          label: name,
          docs,
          kind: "client",
        })),
    ];

    const agencyGroups: DocGroup[] = [
      {
        groupKey: "_agency_playbooks",
        label: "Playbooks",
        docs: noProjectDocs.filter((d) =>
          (d.key ?? "").toLowerCase().includes("playbook") ||
          (d.title ?? "").toLowerCase().includes("playbook"),
        ),
        kind: "agency",
      },
      {
        groupKey: "_agency_sops",
        label: "SOPs",
        docs: noProjectDocs.filter((d) =>
          (d.key ?? "").toLowerCase().includes("sop") ||
          (d.title ?? "").toLowerCase().includes("sop"),
        ),
        kind: "agency",
      },
      {
        groupKey: "_agency_other",
        label: "Other",
        docs: noProjectDocs.filter(
          (d) =>
            !(d.key ?? "").toLowerCase().includes("playbook") &&
            !(d.title ?? "").toLowerCase().includes("playbook") &&
            !(d.key ?? "").toLowerCase().includes("sop") &&
            !(d.title ?? "").toLowerCase().includes("sop"),
        ),
        kind: "agency",
      },
    ];

    return { clients: clientGroups, agency: agencyGroups };
  }, [filtered]);

  if (!selectedCompanyId) {
    return <EmptyState icon={BookOpen} message="Select a company to view the Knowledge Base." />;
  }

  if (isLoading) {
    return <PageSkeleton variant="list" />;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          Knowledge Base
        </h1>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search documents..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}

      {/* Clients Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Clients</h2>
        </div>
        <div className="space-y-2">
          {groups.clients.map((group) => (
            <SectionGroup
              key={group.groupKey}
              label={group.label}
              docs={group.docs}
              companyPrefix={companyPrefix}
            />
          ))}
          {groups.clients.length === 0 && (
            <p className="text-sm text-muted-foreground px-1">No client documents found.</p>
          )}
        </div>
      </div>

      {/* Agency Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Agency</h2>
        </div>
        <div className="space-y-2">
          {groups.agency
            .filter((g) => g.docs.length > 0 || g.groupKey !== "_agency_other")
            .map((group) => (
              <SectionGroup
                key={group.groupKey}
                label={group.label}
                docs={group.docs}
                companyPrefix={companyPrefix}
                defaultOpen={group.docs.length > 0}
              />
            ))}
        </div>
      </div>

      {allDocs && allDocs.length === 0 && (
        <EmptyState
          icon={FileText}
          message="No documents yet. Documents created on issues will appear here."
        />
      )}
    </div>
  );
}
