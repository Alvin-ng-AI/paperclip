import type { CreateTaskGroupInput, TaskGroup } from "@paperclipai/shared";
import { api } from "./client";

export const taskGroupsApi = {
  create: (companyId: string, input: CreateTaskGroupInput) =>
    api.post<TaskGroup>(`/companies/${companyId}/task-groups`, input),

  list: (companyId: string, limit = 20) =>
    api.get<TaskGroup[]>(`/companies/${companyId}/task-groups?limit=${limit}`),

  get: (groupId: string) => api.get<TaskGroup>(`/task-groups/${groupId}`),

  cancel: (groupId: string) => api.post<TaskGroup>(`/task-groups/${groupId}/cancel`, {}),
};
