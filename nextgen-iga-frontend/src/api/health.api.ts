import { apiClient } from '../lib/axios';

export interface HealthStatus {
  status: string;
  services: Record<string, string>;
}

export const healthApi = {
  // GET /health
  check: () =>
    apiClient.get<HealthStatus>('/health').then((r) => r.data),
};
