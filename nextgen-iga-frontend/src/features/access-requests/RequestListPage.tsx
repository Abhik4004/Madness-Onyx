import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { DataTable, type Column } from '../../components/shared/DataTable';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { requestsApi } from '../../api/requests.api';
import { usePagination } from '../../hooks/usePagination';
import { formatDate } from '../../lib/utils';
import type { AccessRequest } from '../../types/request.types';

const STATUSES = ['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED'];

export function RequestListPage() {
  const { page, perPage, setPage } = usePagination();
  const [status, setStatus] = useState('ALL');
  const [search, setSearch] = useState('');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['requests', { page, status: status === 'ALL' ? undefined : status }],
    queryFn: () => requestsApi.list({
      page,
      per_page: perPage,
      status: status === 'ALL' ? undefined : status,
    }),
  });

  const rows = (data?.data ?? []) as AccessRequest[];

  const filtered = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter(r =>
      (r.application_name || r.application_id || "").toLowerCase().includes(q) ||
      (r.role_name || "").toLowerCase().includes(q) ||
      (r.target_user_name || "").toLowerCase().includes(q) ||
      (r.user_name || "").toLowerCase().includes(q)
    );
  }, [rows, search]);

  const columns: Column<AccessRequest>[] = [
    {
      key: 'application',
      header: 'Application',
      render: (r) => <span className="font-medium">{r.application_name}</span>,
    },
    {
      key: 'role',
      header: 'Role',
      render: (r) => r.role_name,
    },
    {
      key: 'for',
      header: 'Requested For',
      render: (r) => {
        const isOnBehalf = r.target_user_id && r.target_user_id !== r.user_id;
        if (isOnBehalf) {
          return (
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontWeight: 600 }}>{r.target_user_name || r.target_user_id}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-gray-400)' }}>by {r.user_name || r.user_id}</span>
            </span>
          );
        }
        return <span style={{ color: 'var(--color-gray-400)', fontSize: '0.85rem' }}>Self</span>;
      },
    },
    {
      key: 'duration',
      header: 'Duration',
      render: (r) => r.duration_seconds ? `${r.duration_seconds}s` : <span className="text-muted">Permanent</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: 'submitted',
      header: 'Submitted',
      render: (r) => formatDate(r.submitted_at),
    },
  ];

  return (
    <div>
      <PageHeader
        title="My Access Requests"
        subtitle="Track your submitted requests and their status"
        actions={
          <Link to="/requests/new" className="btn btn-primary">
            <Plus size={16} /> New Request
          </Link>
        }
      />

      {/* Status tabs */}
      <div className="tabs">
        {STATUSES.map((s) => (
          <button
            key={s}
            className={`tab-btn ${status === s ? 'active' : ''}`}
            onClick={() => { setStatus(s); setPage(1); }}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="filters-bar">
        <div className="search-input-wrap">
          <Search size={14} />
          <input
            className="form-control"
            placeholder="Search requests…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {isError ? (
        <div className="error-state">
          <div className="error-state-title">Failed to load requests</div>
          <div className="error-state-msg">{String(error)}</div>
          <button className="btn btn-secondary" onClick={() => refetch()}>Retry</button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          loading={isLoading}
          totalPages={data?.meta?.total_pages ?? 1}
          currentPage={page}
          total={data?.meta?.total}
          perPage={perPage}
          onPageChange={setPage}
          emptyTitle="No requests found"
          emptyDesc="Submit a new access request to get started"
          emptyAction={<Link to="/requests/new" className="btn btn-primary"><Plus size={14} /> New Request</Link>}
        />
      )}
    </div>
  );
}
