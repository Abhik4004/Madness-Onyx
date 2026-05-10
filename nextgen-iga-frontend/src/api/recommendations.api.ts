import { apiClient } from "../lib/axios";
import type { ApiResponse } from "../types/api.types";
import type { Recommendation, RiskProfile } from "../types/audit.types";

export const recommendationsApi = {
  getUserRecommendations: (userId: string) =>
    apiClient
      .get<ApiResponse<any[]>>(`/api/recommendation/onboarding/${userId}`)
      .then((r) => r.data),

  getTeamRecommendations: (managerId: string) =>
    apiClient
      .get<ApiResponse<any[]>>(`/api/recommendation/team/${managerId}`)
      .then((r) => r.data),

  getRiskProfile: (userId: string) =>
    apiClient
      .get<ApiResponse<RiskProfile>>(`/api/recommendation/risk/${userId}`)
      .then((r) => r.data),

  // Extension endpoints — not in Postman, kept for UI
  accept: (id: string) =>
    apiClient
      .post<
        ApiResponse<{ request_id: string }>
      >(`/api/recommendation/${id}/accept`)
      .then((r) => r.data),

  dismiss: (id: string) =>
    apiClient
      .post<ApiResponse<null>>(`/api/recommendation/${id}/dismiss`)
      .then((r) => r.data),
};
