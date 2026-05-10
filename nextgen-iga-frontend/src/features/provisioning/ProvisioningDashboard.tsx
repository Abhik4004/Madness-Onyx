import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeader } from '../../components/layout/PageHeader';
import { DataTable, type Column } from '../../components/shared/DataTable';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { provisionApi } from '../../api/provision.api';
import { usePagination } from '../../hooks/usePagination';
import { formatDate } from '../../lib/utils';
import type { ProvisioningJob } from '../../types/provision.types';

export function ProvisioningDashboard() {
  const { page, perPage, setPage } = usePagination();
  const [status, setStatus] = useState('');
  const qc = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['provision', 'jobs', { page, status }],
    queryFn: () => provisionApi.listJobs({ page, per_page: perPage, status: status || undefined }),
  });

  const retry = useMutation({
    mutationFn: (jobId: string) => provisionApi.retryJob(jobId),
    onSuccess: () => { toast.success('Job queued for retry'); qc.invalidateQueries({ queryKey: ['provision', 'jobs'] }); },
    onError: () => toast.error('Retry failed'),
  });

  const STATUSES = ['', 'QUEUED', 'IN_PROGRESS', 'COMPLETED', 'FAILED'];

  const columns: Column<ProvisioningJob>[] = [
    { key: 'user', header: 'User', render: j => j.user_name },
    { key: 'app', header: 'Application', render: j => j.application_name },
    { key: 'action', header: 'Action', render: j => j.action },
    { key: 'status', header: 'Status', render: j => <StatusBadge status={j.status} /> },
    { key: 'retries', header: 'Retries', render: j => j.retry_count },
    { key: 'created', header: 'Created', render: j => formatDate(j.created_at) },
    {
      key: 'actions', header: '',
      render: j => (
        <div style={{ display: 'flex', gap: 6 }}>
          <Link to={`/admin/provisioning/${j.id}`} className="btn btn-sm btn-secondary">View</Link>
          {j.status === 'FAILED' && (
            <button className="btn btn-sm btn-primary" disabled={retry.isPending} onClick={() => retry.mutate(j.id)}>
              <RefreshCw size={12} /> Retry
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="fade-in">
      <PageHeader 
        title="Provisioning Jobs" 
        subtitle="Monitor access provisioning and revocation jobs" 
        actions={
          <div style={{ display: 'flex', gap: 10 }}>
            <Link to="/admin/provisioning/csv" className="btn btn-secondary btn-sm">
              Bulk CSV Provision
            </Link>
            <Link to="/admin/users/new" className="btn btn-primary btn-sm">
              Manual Provision
            </Link>
          </div>
        }
      />

      <div className="tabs">
        {STATUSES.map(s => (
          <button key={s} className={`tab-btn ${status === s ? 'active' : ''}`} onClick={() => { setStatus(s); setPage(1); }}>
            {s || 'All'}
          </button>
        ))}
      </div>

      {isError ? (
        <div className="error-state"><div className="error-state-title">Failed to load jobs</div><button className="btn btn-secondary" onClick={() => refetch()}>Retry</button></div>
      ) : (
        <DataTable
          columns={columns}
          data={data?.data ?? []}
          loading={isLoading}
          totalPages={data?.meta?.total_pages ?? 1}
          currentPage={page}
          total={data?.meta?.total}
          perPage={perPage}
          onPageChange={setPage}
          emptyTitle="No provisioning jobs"
        />
      )}
    </div>
  );
}
