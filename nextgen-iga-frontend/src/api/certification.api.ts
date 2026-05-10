import { apiClient } from '../lib/axios';
import type { ApiResponse } from '../types/api.types';
import type { Certification, CertificationItem, CertificationReport } from '../types/certification.types';

export const certificationApi = {
  // POST /api/access/cert/campaign  { name, scope: [...resourceIds], deadline }
  // Response 202: { ok, status: 202, requestId }
  create: (body: any) =>
    apiClient
      .post<ApiResponse<null>>('/api/access/cert/campaign', {
        name: body.name,
        dueDate: body.end_date,
        ownerId: body.ownerId,
        scopeType: body.scopeType,
        creatorId: 'admin'
      })
      .then((r) => r.data),

  // GET /api/access/cert/campaign  (extension)
  list: (params?: { status?: string }) =>
    apiClient
      .get<ApiResponse<Certification[]>>('/api/access/cert/campaign', { params })
      .then((r) => r.data),

  // GET /api/access/cert/campaign/:id  (extension)
  get: (id: string) =>
    apiClient
      .get<ApiResponse<Certification>>(`/api/access/cert/campaign/${id}`)
      .then((r) => r.data),

  // GET /api/access/cert/campaign/:id/items  (extension)
  listItems: (
    id?: string,
    params?: { reviewer_id?: string; decision?: string; page?: number; per_page?: number }
  ) => {
    const url = id ? `/api/access/cert/campaign/${id}/items` : '/api/access/cert/items';
    return apiClient
      .get<ApiResponse<CertificationItem[]>>(url, { params })
      .then((r) => r.data);
  },

  // PUT /api/access/cert/decision  { campaignId, userId, resourceId, decision: "keep"|"revoke", reason }
  // Response 202: { ok, status: 202 }
  certifyItem: (body: {
    itemId: string;
    campaignId: string;
    userId: string;
    resourceId: string;
    comment?: string;
  }) =>
    apiClient
      .put<ApiResponse<null>>('/api/access/cert/decision', {
        itemId: body.itemId,
        campaignId: body.campaignId,
        userId: body.userId,
        resourceId: body.resourceId,
        decision: 'keep',
        reason: body.comment,
      })
      .then((r) => r.data),

  revokeItem: (body: {
    itemId: string;
    campaignId: string;
    userId: string;
    resourceId: string;
    reason: string;
  }) =>
    apiClient
      .put<ApiResponse<null>>('/api/access/cert/decision', {
        itemId: body.itemId,
        campaignId: body.campaignId,
        userId: body.userId,
        resourceId: body.resourceId,
        decision: 'revoke',
        reason: body.reason,
      })
      .then((r) => r.data),

  // GET /api/access/cert/history
  getHistory: () =>
    apiClient
      .get<ApiResponse<any[]>>('/api/access/cert/history')
      .then((r) => r.data),

  // GET /api/access/cert/campaign/:id/report  (extension)
  getReport: (id: string) =>
    apiClient
      .get<ApiResponse<CertificationReport>>(`/api/access/cert/campaign/${id}/report`)
      .then((r) => r.data),
};
