import { apiClient } from '../lib/axios';
import type { ApiResponse, AuditLogPage } from '../types/api.types';

export const auditApi = {
  // GET /api/audit/log?userId=&from=&to=&limit=50
  // Response: { ok, status: 200, data: { logs: [...], total: 150 } }
  list: (params: {
    userId?: string;
    user_id?: string;
    event_type?: string;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
    page?: number;
    per_page?: number;
    search?: string;
  }) =>
    apiClient
      .get<ApiResponse<AuditLogPage>>('/api/audit/log', { params })
      .then((r) => r.data),

  // GET /api/user/audit/log?userId=:userId  (filter by user)
  getUserLogs: (userId: string) =>
    apiClient
      .get<ApiResponse<AuditLogPage>>('/api/audit/log', { params: { userId } })
      .then((r) => r.data),

  // POST /api/audit/report  { type, dateRange: { from, to }, resources }
  // Response: { ok, status: 202, requestId }
  triggerReport: (body: { type: string; from: string; to: string; resources?: string[] }) =>
    apiClient
      .post<ApiResponse<null>>('/api/audit/report', {
        type: body.type,
        dateRange: { from: body.from, to: body.to },
        resources: body.resources,
      })
      .then((r) => r.data),

  // GET /api/audit/log/:id
  get: (id: string) =>
    apiClient
      .get<ApiResponse<any>>(`/api/audit/log/${id}`)
      .then((r) => r.data),

  // GET /api/audit/export  (blob download)
  exportCsv: (params: { from?: string; to?: string }) =>
    apiClient
      .get('/api/audit/export', { params, responseType: 'blob' })
      .then((r) => r.data),
};
