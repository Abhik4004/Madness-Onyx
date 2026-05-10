import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Download, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeader } from '../../components/layout/PageHeader';
import { DataTable, type Column } from '../../components/shared/DataTable';
import { auditApi } from '../../api/audit.api';
import { usePagination } from '../../hooks/usePagination';
import { formatDateTime, formatRelative } from '../../lib/utils';
import type { AuditLog } from '../../types/audit.types';

export function AuditLogExplorerPage() {
  const { page, perPage, setPage } = usePagination();
  const [search, setSearch] = useState('');
  const [eventType, setEventType] = useState('');
  const [userId, setUserId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['audit', { page, eventType, userId, from, to }],
    queryFn: () => auditApi.list({
      page, per_page: perPage,
      event_type: eventType || undefined,
      user_id: userId || undefined,
      from: from || undefined,
      to: to || undefined,
    }),
  });

  const logs = (data?.data?.logs ?? []) as unknown as AuditLog[];

  const filtered = useMemo(() => {
    if (!search) return logs;
    const q = search.toLowerCase();
    return logs.filter(l =>
      l.event_type?.toLowerCase().includes(q) ||
      l.actor_name?.toLowerCase().includes(q) ||
      l.target_id?.toLowerCase().includes(q)
    );
  }, [logs, search]);


  const exportCsv = async () => {
    try {
      const blob = await auditApi.exportCsv({ from: from || undefined, to: to || undefined });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-export-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Export failed');
    }
  };

  const columns: Column<any>[] = [
    {
      key: 'event',
      header: 'Event',
      render: (l) => (
        <span className="badge badge-info" style={{ backgroundColor: '#dbeafe', color: '#1e40af', border: '1px solid #bfdbfe' }}>
          {(l.event_type || 'Unknown').replace(/_/g, ' ')}
        </span>
      ),
    },
    { key: 'actor', header: 'Actor', render: l => l.actor_name || l.actor_id || 'System' },
    { key: 'target', header: 'Target', render: l => l.target_id || '—' },
    { key: 'time', header: 'Time', render: l => formatRelative(l.created_at) },
  ];

  return (
    <div>
      {/* <PageHeader
        title="Audit Logs"
        subtitle="Real-time activity and security trail"
        actions={<button className="btn btn-secondary" onClick={exportCsv}><Download size={14} /> Export CSV</button>}
      /> */}

      <div className="filters-bar" style={{ marginBottom: 20 }}>
        <div className="search-input-wrap" style={{ flex: 1 }}>
          <Search size={14} />
          <input
            className="form-control"
            placeholder="Search by event, actor or target…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => { setSearch(''); setEventType(''); setUserId(''); setFrom(''); setTo(''); }}>Clear</button>
      </div>

      {isError ? (
        <div className="error-state"><div className="error-state-title">Failed to load audit logs</div><button className="btn btn-secondary" onClick={() => refetch()}>Retry</button></div>
      ) : (
        <>
          <DataTable
            columns={columns}
            data={filtered}
            loading={isLoading}
            totalPages={data?.meta?.total_pages ?? 1}
            currentPage={page}
            total={data?.data?.total ?? data?.meta?.total}
            perPage={perPage}
            onPageChange={setPage}
            emptyTitle="No audit logs found"
            emptyDesc="Try adjusting your search or filters."
          />
          {expandedId && (() => {
            const log = data?.data?.logs?.find((l: any) => l.id === expandedId);
            if (!log) return null;
            return (
              <div className="card" style={{ marginTop: 16 }}>
                <div className="card-header">
                  <span className="card-title">Event Context — {log.event_type}</span>
                  <span className="text-xs text-muted">{formatDateTime(log.created_at)}</span>
                </div>
                <div className="json-block" style={{ background: '#f8fafc', padding: 12, borderRadius: 8, fontSize: '0.8rem', border: '1px solid #e2e8f0' }}>
                  <pre>{JSON.stringify(log.details, null, 2)}</pre>
                </div>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
