import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, Search, User, RefreshCw } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { aiApi } from '../../api/ai.api';
import { formatDateTime } from '../../lib/utils';
import { DataTable, type Column } from '../../components/shared/DataTable';

export function AIAuditLogPage() {
  const [filters, setFilters] = useState({
    actor_id: '',
    event_type: '',
    target_id: '',
    from: '',
    to: '',
  });

  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ['ai', 'audit', 'logs', filters],
    queryFn: () => aiApi.getAuditLogs(filters),
  });

  const columns: Column<any>[] = [
    { key: 'timestamp', header: 'Timestamp', render: row => <span className="text-muted">{formatDateTime(row.timestamp)}</span> },
    { key: 'actor', header: 'Actor', render: row => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 24, height: 24, borderRadius: 4, background: 'var(--color-gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <User size={14} />
        </div>
        <div>
          <div className="font-medium">{row.actor}</div>
          <div className="text-xs text-muted">ID: {row.actor_id}</div>
        </div>
      </div>
    )},
    { key: 'event', header: 'Event', render: row => (
      <div>
        <div className="font-medium">{row.event}</div>
        <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>{row.event_type}</span>
      </div>
    )},
    { key: 'target', header: 'Target ID', render: row => <code style={{ fontSize: '0.75rem' }}>{row.target_id}</code> },
    { key: 'details', header: 'Details', render: row => <span className="text-sm">{row.details}</span> },
  ];

  const logsList = Array.isArray(logs) ? logs : [];

  return (
    <div className="fade-in">
      <PageHeader
        title="AI Audit Explorer"
        subtitle="Detailed access and system logs indexed by AI"
        actions={
          <button className="btn btn-secondary btn-sm" onClick={() => refetch()}>
            <RefreshCw size={14} /> Refresh
          </button>
        }
      />

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="grid-4" style={{ gap: 12 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Actor ID</label>
            <div style={{ position: 'relative' }}>
              <input 
                className="form-control" 
                placeholder="Search actor..." 
                value={filters.actor_id}
                onChange={e => setFilters(f => ({ ...f, actor_id: e.target.value }))}
              />
              <Search size={14} style={{ position: 'absolute', right: 10, top: 12, color: 'var(--color-gray-400)' }} />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Event Type</label>
            <select 
              className="form-control"
              value={filters.event_type}
              onChange={e => setFilters(f => ({ ...f, event_type: e.target.value }))}
            >
              <option value="">All Events</option>
              <option value="ACCESS_GRANT">Access Grant</option>
              <option value="ACCESS_REVOKE">Access Revoke</option>
              <option value="LOGIN">Login</option>
              <option value="POLICY_CHANGE">Policy Change</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">From Date</label>
            <input 
              type="date" 
              className="form-control" 
              value={filters.from}
              onChange={e => setFilters(f => ({ ...f, from: e.target.value }))}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">To Date</label>
            <input 
              type="date" 
              className="form-control" 
              value={filters.to}
              onChange={e => setFilters(f => ({ ...f, to: e.target.value }))}
            />
          </div>
        </div>
      </div>

      <DataTable 
        columns={columns} 
        data={logsList} 
        loading={isLoading} 
        emptyTitle="No audit logs found"
      />
    </div>
  );
}
