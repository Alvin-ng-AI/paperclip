import { Router } from "express";
import { z } from "zod";
import type { Db } from "@paperclipai/db";
import { validate } from "../middleware/validate.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { taskOrchestratorService } from "../services/task-orchestrator.js";
import { forbidden } from "../errors.js";
import { loadConfig } from "../config.js";

const createTaskGroupTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  assigneeAgentId: z.string().uuid().optional(),
  priority: z.enum(["critical", "high", "medium", "low"]).optional(),
  projectId: z.string().uuid().optional(),
  goalId: z.string().uuid().optional(),
  dependsOn: z.array(z.string().uuid()).optional(),
  dependsOnTitles: z.array(z.string()).optional(),
});

const createTaskGroupSchema = z.object({
  name: z.string().min(1),
  fanInAgentId: z.string().uuid().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
  tasks: z.array(createTaskGroupTaskSchema).min(1),
});

export function taskGroupRoutes(db: Db) {
  const router = Router();
  const orchestrator = taskOrchestratorService(db);

  // Feature flag guard: parallel execution must be enabled for write operations
  const requireParallelEnabled = (req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) => {
    if (!loadConfig().enableParallelExecution) {
      res.status(501).json({ error: "Parallel execution is not enabled. Set ENABLE_PARALLEL_EXECUTION=true." });
      return;
    }
    next();
  };

  // POST /api/companies/:companyId/task-groups
  router.post(
    "/api/companies/:companyId/task-groups",
    requireParallelEnabled,
    validate(createTaskGroupSchema),
    async (req, res, next) => {
      try {
        const companyId = req.params.companyId as string;
        assertCompanyAccess(req, companyId);
        const actor = getActorInfo(req);

        // Only agents can create task groups
        if (!actor.agentId) {
          throw forbidden("Only agents can create task groups");
        }

        const group = await orchestrator.createTaskGroup(
          companyId,
          actor.agentId,
          req.body,
        );
        res.status(201).json(group);
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /api/companies/:companyId/task-groups
  router.get("/api/companies/:companyId/task-groups", async (req, res, next) => {
    try {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);
      const limit = Math.min(Number(req.query.limit) || 20, 100);
      const groups = await orchestrator.listTaskGroups(companyId, limit);
      res.json(groups);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/task-groups/:groupId
  router.get("/api/task-groups/:groupId", async (req, res, next) => {
    try {
      const group = await orchestrator.getTaskGroup(req.params.groupId!);
      assertCompanyAccess(req, group.companyId);
      res.json(group);
    } catch (err) {
      next(err);
    }
  });

  // POST /api/task-groups/:groupId/cancel
  router.post("/api/task-groups/:groupId/cancel", async (req, res, next) => {
    try {
      const group = await orchestrator.getTaskGroup(req.params.groupId!);
      assertCompanyAccess(req, group.companyId);
      const cancelled = await orchestrator.cancelTaskGroup(req.params.groupId!);
      res.json(cancelled);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
