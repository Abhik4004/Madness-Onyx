import { apiClient } from "../lib/axios";
import type { ApiResponse } from "../types/api.types";

export interface Application {
  id: string;
  app_name: string;
  category?: string;
  description?: string;
  status?: string;
  risk_level?: string;
  risk_score?: number;
}

export const applicationsApi = {
  /**
   * GET /api/applications
   */
  list: () => 
    apiClient.get<ApiResponse<Application[]>>("/api/applications").then((r) => r.data),

  /**
   * GET /api/applications/:id
   */
  get: (id: string) =>
    apiClient.get<ApiResponse<Application>>(`/api/applications/${id}`).then((r) => r.data),

  /**
   * POST /api/create/group
   * Special endpoint that relays via Gateway -> EventManager -> External LDAP API
   * Body: { groupCn, owner, appName, riskLevel, riskScore }
   */
  createGroup: (body: { groupCn: string; owner: string; appName: string; riskLevel?: string; riskScore?: number }) =>
    apiClient.post<ApiResponse<any>>("/api/create/group", body).then((r) => r.data),
};
