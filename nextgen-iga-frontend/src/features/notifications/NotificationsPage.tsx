import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeader } from '../../components/layout/PageHeader';
import { notificationsApi } from '../../api/notifications.api';
import { formatRelative } from '../../lib/utils';
import { usePagination } from '../../hooks/usePagination';

export function NotificationsPage() {
  const { page, perPage, setPage } = usePagination();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', { page }],
    queryFn: () => notificationsApi.list({ page, per_page: perPage }),
    refetchInterval: 30_000,
  });

  const markRead = useMutation({
    mutationFn: notificationsApi.markRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllRead = async () => {
    const unread = data?.data?.filter(n => !n.read) ?? [];
    await Promise.all(unread.map(n => notificationsApi.markRead(n.id)));
    qc.invalidateQueries({ queryKey: ['notifications'] });
    toast.success('All marked as read');
  };

  const notifications = data?.data ?? [];
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="Stay updated on your requests and approvals"
        actions={unreadCount > 0 ? (
          <button className="btn btn-secondary btn-sm" onClick={markAllRead}><CheckCheck size={14} /> Mark all read</button>
        ) : undefined}
      />

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: 72, borderRadius: 'var(--radius-lg)' }} />)}
        </div>
      ) : notifications.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Bell size={28} /></div>
          <div className="empty-state-title">No notifications</div>
          <div className="empty-state-desc">You're all caught up!</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {notifications.map(n => (
            <div
              key={n.id}
              style={{
                background: n.read ? 'var(--color-white)' : 'var(--color-primary-light)',
                border: '1px solid var(--color-gray-200)',
                borderRadius: 'var(--radius-lg)',
                padding: '14px 16px',
                display: 'flex',
                gap: 14,
                cursor: n.read ? 'default' : 'pointer',
              }}
              onClick={() => !n.read && markRead.mutate(n.id)}
            >
              {!n.read && <span className="notif-dot" style={{ marginTop: 5 }} />}
              <div style={{ flex: 1 }}>
                <div className="font-semibold text-sm">{n.title}</div>
                <div className="text-sm text-muted" style={{ marginTop: 2 }}>{n.message}</div>
                <div className="text-xs text-muted" style={{ marginTop: 6 }}>{formatRelative(n.created_at)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {(data?.meta?.total_pages ?? 1) > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
          <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button>
          <span className="text-sm text-muted" style={{ padding: '8px 4px' }}>Page {page} of {data?.meta?.total_pages}</span>
          <button className="btn btn-secondary btn-sm" disabled={page >= (data?.meta?.total_pages ?? 1)} onClick={() => setPage(page + 1)}>Next →</button>
        </div>
      )}
    </div>
  );
}
