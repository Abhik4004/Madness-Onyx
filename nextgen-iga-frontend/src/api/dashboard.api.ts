import { apiClient } from '../lib/axios';
import type { ApiResponse } from '../types/api.types';
import type { HealthStatus } from './health.api';

export interface AdminDashboardStats {
  total_users: number;
  pending_requests: number;
  failed_jobs: number;
  open_certifications: number;
  system_health: HealthStatus;
  recent_audit_events: Array<{
    id: string;
    event_type: string;
    actor_name: string;
    created_at: string;
  }>;
}

export const dashboardApi = {
  // GET /api/admin/dashboard
  // Returns aggregated stats for the admin dashboard in one call
  getAdminStats: () =>
    apiClient
      .get<ApiResponse<AdminDashboardStats>>('/api/admin/dashboard')
      .then((r) => r.data),
};
