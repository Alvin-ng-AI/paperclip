import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { issueService } from "../services/index.js";
import { assertCompanyAccess } from "./authz.js";

const CLAWD_OS_PROJECT_ID = "a4eee6ed-bbf5-4c4c-baae-573bd123288a";

export function roadmapRoutes(db: Db) {
  const router = Router();
  const issueSvc = issueService(db);

  router.get("/companies/:companyId/roadmap", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const [nowIssues, backlogIssues, doneIssues] = await Promise.all([
      issueSvc.list(companyId, {
        projectId: CLAWD_OS_PROJECT_ID,
        status: "in_progress,todo",
      }),
      issueSvc.list(companyId, {
        projectId: CLAWD_OS_PROJECT_ID,
        status: "backlog",
      }),
      issueSvc.list(companyId, {
        projectId: CLAWD_OS_PROJECT_ID,
        status: "done",
      }),
    ]);

    // Split backlog into next (high/critical) vs later (medium/low)
    const next = backlogIssues.filter(
      (i) => i.priority === "high" || i.priority === "critical",
    );
    const later = backlogIssues.filter(
      (i) => i.priority === "medium" || i.priority === "low",
    );

    // Proposals: static empty array for now
    // In the future these can be stored in a dedicated table or document
    const proposals: unknown[] = [];

    res.json({
      now: nowIssues,
      next,
      later,
      done: doneIssues,
      proposals,
    });
  });

  return router;
}
