import { api } from "./client";

export interface CompanyDocument {
  id: string;
  companyId: string;
  issueId: string;
  issueTitle: string | null;
  issueIdentifier: string | null;
  projectId: string | null;
  projectName: string | null;
  key: string;
  title: string | null;
  format: string;
  latestRevisionId: string | null;
  latestRevisionNumber: number;
  createdByAgentId: string | null;
  createdByUserId: string | null;
  updatedByAgentId: string | null;
  updatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export const documentsApi = {
  listForCompany: (companyId: string) =>
    api.get<CompanyDocument[]>(`/companies/${companyId}/documents`),
};
