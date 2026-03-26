import { useMemo } from "react";
import { NavLink, useLocation } from "@/lib/router";
import {
  House,
  CircleDot,
  SquarePen,
  Users,
  Inbox,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { useDialog } from "../context/DialogContext";
import { cn } from "../lib/utils";
import { useInboxBadge } from "../hooks/useInboxBadge";
import { issuesApi } from "../api/issues";
import { queryKeys } from "../lib/queryKeys";

interface MobileBottomNavProps {
  visible: boolean;
}

interface MobileNavLinkItem {
  type: "link";
  to: string;
  label: string;
  icon: typeof House;
  badge?: number;
  badgeTone?: "primary" | "danger" | "amber";
}

interface MobileNavActionItem {
  type: "action";
  label: string;
  icon: typeof SquarePen;
  onClick: () => void;
}

type MobileNavItem = MobileNavLinkItem | MobileNavActionItem;

export function MobileBottomNav({ visible }: MobileBottomNavProps) {
  const location = useLocation();
  const { selectedCompanyId } = useCompany();
  const { openNewIssue } = useDialog();
  const inboxBadge = useInboxBadge(selectedCompanyId);

  const { data: blockedIssues } = useQuery({
    queryKey: [...queryKeys.issues.list(selectedCompanyId!), "blocked"],
    queryFn: () => issuesApi.list(selectedCompanyId!, { status: "blocked" }),
    enabled: !!selectedCompanyId,
    refetchInterval: 30_000,
  });
  const blockedCount = blockedIssues?.length ?? 0;

  const { data: reviewIssues } = useQuery({
    queryKey: [...queryKeys.issues.list(selectedCompanyId!), "in_review"],
    queryFn: () => issuesApi.list(selectedCompanyId!, { status: "in_review" }),
    enabled: !!selectedCompanyId,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const reviewCount = reviewIssues?.length ?? 0;

  const issuesBadge = blockedCount > 0 ? blockedCount : reviewCount > 0 ? reviewCount : undefined;
  const issuesBadgeTone = blockedCount > 0 ? "danger" : reviewCount > 0 ? "amber" : "primary";

  const items = useMemo<MobileNavItem[]>(
    () => [
      { type: "link", to: "/dashboard", label: "Home", icon: House },
      {
        type: "link",
        to: "/issues",
        label: "Issues",
        icon: CircleDot,
        badge: issuesBadge,
        badgeTone: issuesBadgeTone,
      },
      { type: "action", label: "Create", icon: SquarePen, onClick: () => openNewIssue() },
      { type: "link", to: "/agents/all", label: "Agents", icon: Users },
      {
        type: "link",
        to: "/inbox",
        label: "Inbox",
        icon: Inbox,
        badge: inboxBadge.inbox,
      },
    ],
    [openNewIssue, inboxBadge.inbox, issuesBadge, issuesBadgeTone],
  );

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85 transition-transform duration-200 ease-out md:hidden pb-[env(safe-area-inset-bottom)]",
        visible ? "translate-y-0" : "translate-y-full",
      )}
      aria-label="Mobile navigation"
    >
      <div className="grid h-16 grid-cols-5 px-1">
        {items.map((item) => {
          if (item.type === "action") {
            const Icon = item.icon;
            const active = /\/issues\/new(?:\/|$)/.test(location.pathname);
            return (
              <button
                key={item.label}
                type="button"
                onClick={item.onClick}
                className={cn(
                  "relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-md text-[10px] font-medium transition-colors",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          }

          const Icon = item.icon;
          return (
            <NavLink
              key={item.label}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-md text-[10px] font-medium transition-colors",
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span className="relative">
                    <Icon className={cn("h-[18px] w-[18px]", isActive && "stroke-[2.3]")} />
                    {item.badge != null && item.badge > 0 && (
                      <span className={cn(
                        "absolute -right-2 -top-2 rounded-full px-1.5 py-0.5 text-[10px] leading-none",
                        item.badgeTone === "danger" ? "bg-red-600/90 text-red-50"
                        : item.badgeTone === "amber" ? "bg-amber-500/20 text-amber-500"
                        : "bg-primary text-primary-foreground",
                      )}>
                        {item.badge > 99 ? "99+" : item.badge}
                      </span>
                    )}
                  </span>
                  <span className="truncate">{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
