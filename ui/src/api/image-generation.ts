import { api } from "./client";

export interface GenerateImageResult {
  imageUrl: string;
  mimeType: string;
}

export const imageGenerationApi = {
  generateImage: (
    companyId: string,
    body: {
      prompt: string;
      style?: string;
      aspectRatio?: "1:1" | "16:9" | "9:16";
    },
  ) => api.post<GenerateImageResult>(`/companies/${companyId}/generate-image`, body),
};
