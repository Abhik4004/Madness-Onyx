import { apiClient } from "../lib/axios";
import type { ApiResponse } from "../types/api.types";
import type {
  AccessRequest,
  Application,
  AppRole,
} from "../types/request.types";

export interface BackendAccessRequest {
  requestId: string;
  id?: string;
  resourceId: string;
  status: string;
  justification: string;
  duration: number;
  requestedBy: string;
  // User info
  user_name?: string;
  target_user_name?: string;
  approver_name?: string;
  // Application / Role
  application_name?: string;
  role_name?: string;
  // Timestamps
  submitted_at?: string;
  decided_at?: string | null;
  activated_at?: string | null;
  provisioned_at?: string | null;
  revoked_at?: string | null;
  valid_from?: string | null;
  valid_till?: string | null;
  // Decision info
  approver_comment?: string | null;
  rejection_reason?: string | null;
  // User / context
  user_id?: string;
  expires_at?: string | null;
  duration_days?: number | null;
}

interface CreateRequestBody {
  resourceId?: string;
  application_id?: string;
  application_name?: string;
  role_id?: string;
  role_name?: string;
  justification: string;
  duration?: number;
  duration_days?: number;
  role?: string;
  customRole?: string;
  targetUserId?: string;
}

interface ListParams {
  page?: number;
  per_page?: number;
  status?: string;
  application_id?: string;
}

interface CreateAppBody {
  name: string;
  description: string;
  owner_id: string;
  category: string;
}

const r = <T>(p: Promise<{ data: T }>) => p.then((res) => res.data);

export const requestsApi = {
  create: (body: CreateRequestBody) => {
    const isTimeBased = (body.duration ?? body.duration_days ?? 0) > 0;
    const url = isTimeBased ? "/api/access/time" : "/api/access/request";

    let payload: any;
    if (isTimeBased) {
      // New format for Provisioning Service
      const days = body.duration ?? body.duration_days ?? 30;
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + days);

      payload = {
        uid: body.targetUserId,
        privilege_access: body.resourceId ?? body.application_id ?? "",
        end_date: expiry.toISOString().split('T')[0],
        end_time: expiry.toTimeString().split(' ')[0],
      };
    } else {
      const roleName = body.role === "other" ? body.customRole : (body.role || body.role_name);
      payload = {
        resourceId: body.resourceId ?? body.application_id ?? "",
        application_name: body.application_name ?? "",
        role_id: body.role ?? "",
        role_name: roleName || "",
        justification: body.justification,
        duration: body.duration ?? body.duration_days,
        ...(body.targetUserId ? { targetUserId: body.targetUserId } : {}),
      };
    }

    console.debug(`[requestsApi.create] routing to ${url} | payload →`, payload);
    return r(
      apiClient.post<
        ApiResponse<{ id: string; status: string; submitted_at: string }>
      >(url, payload),
    );
  },

  list: (params: ListParams) =>
    r(
      apiClient.get<ApiResponse<AccessRequest[]>>("/api/access/request", {
        params,
      }),
    ),

  get: (id: string) =>
    r(
      apiClient.get<ApiResponse<BackendAccessRequest>>(
        `/api/access/request/${id}`,
      ),
    ),

  approve: (id: string, body: { comment?: string }) =>
    r(
      apiClient.put<ApiResponse<null>>(`/api/access/request/${id}`, {
        status: "approved",
        reviewNote: body.comment,
      }),
    ),

  reject: (id: string, body: { reason: string }) =>
    r(
      apiClient.put<ApiResponse<null>>(`/api/access/request/${id}`, {
        status: "rejected",
        reviewNote: body.reason,
      }),
    ),

  cancel: (id: string) =>
    r(
      apiClient.put<ApiResponse<null>>(`/api/access/request/${id}`, {
        status: "cancelled",
      }),
    ),

  listApplications: (params: { search?: string; category?: string }) =>
    r(
      apiClient.get<ApiResponse<Application[]>>("/api/applications", {
        params,
      }),
    ),

  getApplication: (id: string) =>
    r(apiClient.get<ApiResponse<Application>>(`/api/applications/${id}`)),

  createApplication: (body: CreateAppBody) =>
    r(apiClient.post<ApiResponse<Application>>("/api/applications", body)),

  getApplicationRoles: (appId: string) =>
    r(
      apiClient.get<ApiResponse<AppRole[]>>(`/api/applications/${appId}/roles`),
    ),
};
