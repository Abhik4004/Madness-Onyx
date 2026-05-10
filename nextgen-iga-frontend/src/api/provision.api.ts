import { apiClient } from '../lib/axios';
import type { ApiResponse } from '../types/api.types';
import type { UserAccess, ProvisioningJob } from '../types/provision.types';

// CSV preview response
export interface CsvPreviewData {
  total_rows: number;
  valid_rows: number;
  error_rows: number;
  errors: Array<{ row: number; msg: string }>;
  preview: Array<{ email: string; username: string; role: string }>;
}

// CSV submit response
export interface CsvSubmitData {
  action: string;
  results: Array<{
    uid: string;
    status: 'SUCCESS' | 'FAILURE';
    message: string;
  }>;
}

export const provisionApi = {
  // POST /api/provision/view  (multipart/form-data)
  // Response: { ok, data: { total_rows, valid_rows, error_rows, errors, preview } }
  previewCsv: (file: File, onProgress?: (percent: number) => void) => {
    const form = new FormData();
    form.append('file', file);
    return apiClient
      .post<ApiResponse<CsvPreviewData>>('/api/provision/view', form, {
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress(percent);
          }
        },
      })
      .then((r) => r.data);
  },

  // POST /api/provision/users  (application/json)
  // Response: { action, results: [...] }
  submitCsv: (users: any[]) => {
    return apiClient
      .post<CsvSubmitData>('/api/provision/users', { users })
      .then((r) => r.data);
  },

  // Legacy alias
  submitBulk: (users: any[]) => {
    return apiClient
      .post<CsvSubmitData>('/api/provision/users', { users })
      .then((r) => r.data);
  },

  // POST /api/provision/users  (application/json) — unified for single + bulk
  provision: (body: { 
    uid: string;
    givenName: string;
    sn: string;
    cn: string;
    title?: string;
    mail: string;
    password: string;
    role: string;
  }) =>
    apiClient
      .post<CsvSubmitData>('/api/provision/users', { users: [body] })
      .then((r) => r.data),

  // DELETE /api/provision/user/:userId
  // Response 202: { ok, status: 202, message }
  deprovision: (userId: string) =>
    apiClient
      .delete<ApiResponse<null>>(`/api/provision/user/${userId}`)
      .then((r) => r.data),

  // Alias used by ActiveAccessPage + TeamMemberDetailPage
  revoke: (body: { user_id: string; application_id?: string; role_id?: string; reason?: string }) =>
    apiClient
      .delete<ApiResponse<null>>(`/api/provision/user/${body.user_id}`)
      .then((r) => r.data),

  // POST /api/access/time  { userId, resourceId, startsAt, expiresAt }
  // Response 202: { ok, status: 202, requestId }
  createTimeAccess: (body: {
    userId: string;
    resourceId: string;
    startsAt: string;
    expiresAt: string;
  }) => {
    // Map to the new format for Provisioning Service
    const payload = {
      uid: body.userId,
      privilege_access: body.resourceId,
      end_date: body.expiresAt.split('T')[0],
      end_time: body.expiresAt.split('T')[1]?.split('.')[0] || "00:00:00",
    };
    return apiClient
      .post<ApiResponse<null>>('/api/access/time', payload)
      .then((r) => r.data);
  },

  // GET /api/access/time
  listTimeAccess: () =>
    apiClient
      .get<ApiResponse<UserAccess[]>>('/api/access/time')
      .then((r) => r.data),

  // DELETE /api/access/time/:id
  // Response 202: { ok, status: 202 }
  revokeTimeAccess: (id: string) =>
    apiClient
      .delete<ApiResponse<null>>(`/api/access/time/${id}`)
      .then((r) => r.data),

  // GET /api/user/:userId/access  (extension)
  getUserAccess: (userId: string) =>
    apiClient
      .get<ApiResponse<UserAccess[]>>(`/api/user/${userId}/access`)
      .then((r) => r.data),

  // GET /api/access/active
  listActiveAccess: () =>
    apiClient
      .get<ApiResponse<UserAccess[]>>('/api/access/active')
      .then((r) => r.data),

  // GET /api/provision/jobs
  listJobs: (params?: { page?: number; per_page?: number; status?: string }) =>
    apiClient
      .get<ApiResponse<ProvisioningJob[]>>('/api/provision/jobs', { params })
      .then((r) => r.data),

  // GET /api/provision/jobs/:id
  getJob: (id: string) =>
    apiClient
      .get<ApiResponse<ProvisioningJob>>(`/api/provision/jobs/${id}`)
      .then((r) => r.data),

  // POST /api/provision/jobs/:id/retry
  retryJob: (id: string) =>
    apiClient
      .post<ApiResponse<null>>(`/api/provision/jobs/${id}/retry`, {})
      .then((r) => r.data),
};
