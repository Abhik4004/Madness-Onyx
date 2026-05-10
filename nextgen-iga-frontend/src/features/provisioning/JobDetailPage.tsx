import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeader } from '../../components/layout/PageHeader';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { provisionApi } from '../../api/provision.api';
import { formatDateTime } from '../../lib/utils';

export function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const qc = useQueryClient();

  const { data, isLoading, isError } = useQuery({ queryKey: ['job', jobId], queryFn: () => provisionApi.getJob(jobId!), enabled: !!jobId });

  const retry = useMutation({
    mutationFn: () => provisionApi.retryJob(jobId!),
    onSuccess: () => { toast.success('Retry queued'); qc.invalidateQueries({ queryKey: ['job', jobId] }); },
    onError: () => toast.error('Retry failed'),
  });

  if (isLoading) return <div className="card"><div className="skeleton" style={{ height: 300 }} /></div>;
  const job = data?.data;
  if (isError || !job) return (
    <div className="error-state"><AlertTriangle size={32} className="error-state-icon" /><div className="error-state-title">Job not found</div><Link to="/admin/provisioning" className="btn btn-secondary">← Back</Link></div>
  );

  return (
    <div>
      <PageHeader
        title={`Job ${job.id.slice(0, 8)}…`}
        breadcrumbs={[{ label: 'Provisioning', to: '/admin/provisioning' }, { label: 'Job Detail' }]}
        actions={job.status === 'FAILED' ? (
          <button className="btn btn-primary" disabled={retry.isPending} onClick={() => retry.mutate()}>
            {retry.isPending ? <span className="spinner" /> : <RefreshCw size={14} />} Retry
          </button>
        ) : undefined}
      />

      <div className="grid-2" style={{ gap: 20 }}>
        <div className="card">
          <div className="card-header"><span className="card-title">Job Details</span><StatusBadge status={job.status} /></div>
          {[
            { label: 'User', value: job.user_name },
            { label: 'Application', value: job.application_name },
            { label: 'Action', value: job.action },
            { label: 'Retry Count', value: job.retry_count },
            { label: 'Created', value: formatDateTime(job.created_at) },
            { label: 'Updated', value: formatDateTime(job.updated_at) },
            job.completed_at ? { label: 'Completed', value: formatDateTime(job.completed_at) } : null,
          ].filter(Boolean).map(item => (
            <div key={item!.label} style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: 8, padding: '10px 0', borderBottom: '1px solid var(--color-gray-100)' }}>
              <span className="text-xs text-muted font-semibold" style={{ textTransform: 'uppercase', letterSpacing: '0.4px', paddingTop: 2 }}>{item!.label}</span>
              <span className="text-sm">{item!.value}</span>
            </div>
          ))}
        </div>

        {job.error_message && (
          <div className="card">
            <div className="card-header"><span className="card-title" style={{ color: 'var(--color-danger)' }}>Error Details</span></div>
            <div className="json-block">{job.error_message}</div>
          </div>
        )}
      </div>
    </div>
  );
}
