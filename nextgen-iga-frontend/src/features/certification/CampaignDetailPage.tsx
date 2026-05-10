import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeader } from '../../components/layout/PageHeader';
import { DataTable, type Column } from '../../components/shared/DataTable';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { certificationApi } from '../../api/certification.api';
import { usePagination } from '../../hooks/usePagination';
import { formatDate } from '../../lib/utils';
import type { CertificationItem } from '../../types/certification.types';
import { AIChatbot } from '../ai/AIChatbot';

export function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { page, perPage, setPage } = usePagination();
  const qc = useQueryClient();
  const [revokeTarget, setRevokeTarget] = useState<CertificationItem | null>(null);
  const [revokeReason, setRevokeReason] = useState('');

  const certQuery = useQuery({
    queryKey: ['certifications', id],
    queryFn: () => certificationApi.get(id!),
    enabled: !!id,
  });

  const itemsQuery = useQuery({
    queryKey: ['certItems', id, { page }],
    queryFn: () => certificationApi.listItems(id!, { page, per_page: perPage }),
    enabled: !!id,
  });

  const certify = useMutation({
    mutationFn: (item: CertificationItem) => certificationApi.certifyItem({
      itemId: item.id,
      campaignId: item.certification_id,
      userId: item.user_id,
      resourceId: item.application_id,
      comment: 'Certified from Campaign View'
    }),
    onSuccess: () => { toast.success('Certified'); qc.invalidateQueries({ queryKey: ['certItems'] }); },
    onError: () => toast.error('Failed to certify'),
  });

  const revokeItem = useMutation({
    mutationFn: () => certificationApi.revokeItem({
      itemId: revokeTarget!.id,
      campaignId: revokeTarget!.certification_id,
      userId: revokeTarget!.user_id,
      resourceId: revokeTarget!.application_id,
      reason: revokeReason
    }),
    onSuccess: () => { toast.success('Revoked'); qc.invalidateQueries({ queryKey: ['certItems'] }); setRevokeTarget(null); },
    onError: () => toast.error('Failed to revoke'),
  });

  const cert = certQuery.data?.data;

  const columns: Column<CertificationItem>[] = [
    { key: 'user', header: 'User', render: i => <span className="font-medium">{i.user_name}</span> },
    { key: 'app', header: 'Application', render: i => i.application_name },
    { key: 'decision', header: 'Decision', render: i => <StatusBadge status={i.decision} /> },
    {
      key: 'actions', header: '', width: '160px',
      render: i => i.decision === 'PENDING' ? (
        <div style={{ display: 'flex', gap: 6 }}>
          <button 
            className="btn btn-sm btn-primary" 
            onClick={() => certify.mutate(i)} 
            disabled={certify.isPending && certify.variables?.user_id === i.user_id && certify.variables?.application_id === i.application_id}
          >
            {certify.isPending && certify.variables?.user_id === i.user_id && certify.variables?.application_id === i.application_id ? <span className="spinner spinner-sm" /> : 'Certify'}
          </button>
          <button 
            className="btn btn-sm btn-danger" 
            onClick={() => { setRevokeTarget(i); setRevokeReason(''); }}
          >
            Revoke
          </button>
        </div>
      ) : null,
    },
  ];

  if (!cert && !certQuery.isLoading) return (
    <div className="error-state"><AlertTriangle size={32} className="error-state-icon" /><div className="error-state-title">Campaign not found</div><Link to="/admin/certifications" className="btn btn-secondary">← Back</Link></div>
  );

  const pct = cert ? (cert.total_items > 0 ? Math.round(((cert.certified_count + cert.revoked_count) / cert.total_items) * 100) : 0) : 0;

  return (
    <div>
      <PageHeader
        title={cert?.name ?? '…'}
        breadcrumbs={[{ label: 'Certifications', to: '/admin/certifications' }, { label: cert?.name ?? '' }]}
        actions={undefined}
      />

      {cert && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
            <div><div className="text-xs text-muted font-semibold" style={{ textTransform: 'uppercase' }}>Status</div><div style={{ marginTop: 4 }}><StatusBadge status={cert.status} /></div></div>
            <div><div className="text-xs text-muted font-semibold" style={{ textTransform: 'uppercase' }}>Period</div><div className="text-sm" style={{ marginTop: 4 }}>{formatDate(cert.start_date || cert.created_at)} — {formatDate(cert.end_date)}</div></div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span className="text-xs text-muted">Completion</span>
                <span className="text-xs font-semibold">{pct}%</span>
              </div>
              <div className="progress-bar"><div className="progress-bar-fill" style={{ width: `${pct}%` }} /></div>
              <div className="text-xs text-muted" style={{ marginTop: 4 }}>
                {cert.certified_count} certified · {cert.revoked_count} revoked · {cert.pending_count} pending
              </div>
            </div>
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={itemsQuery.data?.data ?? []}
        loading={itemsQuery.isLoading}
        totalPages={itemsQuery.data?.meta?.total_pages ?? 1}
        currentPage={page}
        total={itemsQuery.data?.meta?.total}
        perPage={perPage}
        onPageChange={setPage}
        emptyTitle="No items in this campaign"
      />

      {revokeTarget && (
        <div className="modal-overlay" onClick={() => setRevokeTarget(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Revoke Access</h2>
              <button className="btn-icon" onClick={() => setRevokeTarget(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label required">Reason</label>
                <textarea className="form-control" value={revokeReason} onChange={e => setRevokeReason(e.target.value)} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setRevokeTarget(null)}>Cancel</button>
              <button className="btn btn-danger" disabled={!revokeReason.trim() || revokeItem.isPending} onClick={() => revokeItem.mutate()}>
                {revokeItem.isPending ? <span className="spinner" /> : null} Revoke
              </button>
            </div>
          </div>
        </div>
      )}
      <AIChatbot context={{ page: 'certification' }} />
    </div>
  );
}
