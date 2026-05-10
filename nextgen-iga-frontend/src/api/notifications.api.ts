import { apiClient } from '../lib/axios';
import type { ApiResponse } from '../types/api.types';
import type { Notification, NotificationPreference } from '../types/notification.types';

export const notificationsApi = {
  list: (params: { read?: boolean; page?: number; per_page?: number }) =>
    apiClient
      .get<ApiResponse<Notification[]>>('/api/notifications', {
        params: { read: params.read }, // API does not support pagination
        // Don't trigger the global 401 refresh loop — endpoint may not exist yet
        validateStatus: (s) => s < 500,
      })
      .then((r) => (r.status === 200 ? r.data : { status: r.status, data: [] as unknown as Notification[] })),

  markRead: (id: string) =>
    apiClient.put<ApiResponse<null>>(`/api/notifications/${id}/read`).then((r) => r.data),

  getPreferences: () =>
    apiClient.get<ApiResponse<NotificationPreference[]>>('/api/notifications/preferences').then((r) => r.data),

  updatePreferences: (preferences: NotificationPreference[]) =>
    apiClient
      .put<ApiResponse<null>>('/api/notifications/preferences', { preferences })
      .then((r) => r.data),
};
