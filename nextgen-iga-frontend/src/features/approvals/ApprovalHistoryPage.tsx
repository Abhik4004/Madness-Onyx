import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { DataTable, type Column } from '../../components/shared/DataTable';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { requestsApi } from '../../api/requests.api';
import { usePagination } from '../../hooks/usePagination';
import { formatDate } from '../../lib/utils';
import type { AccessRequest } from '../../types/request.types';

export function ApprovalHistoryPage() {
  const { page, perPage, setPage } = usePagination();
  const [search, setSearch] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['approvals', 'history', { page }],
    queryFn: () => requestsApi.list({ page, per_page: perPage }),
  });

  const rows = (data?.data ?? []).filter(r => r.status !== 'PENDING');

  const columns: Column<AccessRequest>[] = [
    { key: 'requester', header: 'Requester', render: r => <span className="font-medium">{r.user_name}</span> },
    { key: 'app', header: 'Application', render: r => r.application_name },
    { key: 'status', header: 'Decision', render: r => <StatusBadge status={r.status} /> },
    { key: 'decided', header: 'Decided', render: r => r.decided_at ? formatDate(r.decided_at) : '—' },
  ];

  return (
    <div>
      <PageHeader
        title="Approval History"
        subtitle="All decisions you have made"
        breadcrumbs={[{ label: 'Approvals', to: '/supervisor/approvals' }, { label: 'History' }]}
      />

      <div className="filters-bar">
        <div className="search-input-wrap">
          <Search size={14} />
          <input className="form-control" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {isError ? (
        <div className="error-state">
          <div className="error-state-title">Failed to load history</div>
          <button className="btn btn-secondary" onClick={() => refetch()}>Retry</button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={rows.filter(r => !search || r.user_name.toLowerCase().includes(search.toLowerCase()))}
          loading={isLoading}
          totalPages={data?.meta?.total_pages ?? 1}
          currentPage={page}
          total={data?.meta?.total}
          perPage={perPage}
          onPageChange={setPage}
          emptyTitle="No approval history"
          emptyDesc="Your past decisions will appear here"
        />
      )}
    </div>
  );
}
