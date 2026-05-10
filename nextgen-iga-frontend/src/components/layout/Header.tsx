import { useState, useRef, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '../../api/notifications.api';
import { formatRelative } from '../../lib/utils';
import { Link } from 'react-router-dom';

export function Header() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['notifications', { read: false }],
    queryFn: () => notificationsApi.list({ read: false, per_page: 10 }),
    refetchInterval: 30_000,
  });

  const markRead = useMutation({
    mutationFn: notificationsApi.markRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const notifications = data?.data ?? [];
  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <header className="header">
      <div className="header-spacer" />
      <div className="header-actions">
        <div className="dropdown" ref={panelRef}>
          <button
            className="btn-icon notif-badge"
            onClick={() => setOpen(!open)}
            aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
          >
            <Bell size={20} />
            {unreadCount > 0 && <span className="count">{unreadCount > 99 ? '99+' : unreadCount}</span>}
          </button>

          {open && (
            <div className="dropdown-menu notif-panel" style={{ right: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--color-gray-200)' }}>
                <span className="font-semibold text-sm">Notifications</span>
                <button className="btn-icon" onClick={() => setOpen(false)} aria-label="Close notifications"><X size={14} /></button>
              </div>
              {notifications.length === 0 ? (
                <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--color-gray-500)', fontSize: '0.875rem' }}>
                  No new notifications
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`notif-item ${!n.read ? 'unread' : ''}`}
                    onClick={() => { if (!n.read) markRead.mutate(n.id); setOpen(false); }}
                  >
                    {!n.read && <span className="notif-dot" />}
                    <div style={{ flex: 1 }}>
                      <div className="notif-title">{n.title}</div>
                      <div className="notif-msg">{n.message}</div>
                      <div className="notif-time">{formatRelative(n.created_at)}</div>
                    </div>
                  </div>
                ))
              )}
              <div style={{ padding: '10px 16px', borderTop: '1px solid var(--color-gray-200)' }}>
                <Link to="/notifications" className="text-sm" onClick={() => setOpen(false)}>View all notifications →</Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
