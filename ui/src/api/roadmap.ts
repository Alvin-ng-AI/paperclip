import type { Issue } from "@paperclipai/shared";
import { api } from "./client";

export interface RoadmapProposal {
  id: string;
  title: string;
  description: string;
  source: string;
  status: "pending" | "approved" | "rejected";
}

export interface RoadmapData {
  now: Issue[];
  next: Issue[];
  later: Issue[];
  done: Issue[];
  proposals: RoadmapProposal[];
}

export const roadmapApi = {
  get: (companyId: string) =>
    api.get<RoadmapData>(`/companies/${companyId}/roadmap`),
};
