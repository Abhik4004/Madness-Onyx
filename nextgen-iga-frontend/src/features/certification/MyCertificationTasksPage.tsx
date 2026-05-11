import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeader } from '../../components/layout/PageHeader';
import { DataTable, type Column } from '../../components/shared/DataTable';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { certificationApi } from '../../api/certification.api';
import { usePagination } from '../../hooks/usePagination';
import { useAuth } from '../../hooks/useAuth';
import type { CertificationItem } from '../../types/certification.types';
import { AIChatbot } from '../ai/AIChatbot';

export function MyCertificationTasksPage() {
  const { user } = useAuth();
  const { page, perPage, setPage } = usePagination();
  const [revokeTarget, setRevokeTarget] = useState<CertificationItem | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const qc = useQueryClient();

  // Get first active cert to show tasks from
  const certsQuery = useQuery({
    queryKey: ['certifications', { status: 'ACTIVE' }],
    queryFn: () => certificationApi.list({ status: 'ACTIVE' }),
  });
  const activeCert = certsQuery.data?.data?.[0];
  const certId = activeCert?.id;

  const itemsQuery = useQuery({
    queryKey: ['certItems', { reviewer_id: user?.id, page }],
    queryFn: () => certificationApi.listItems(undefined, { reviewer_id: user!.id, page, per_page: perPage }),
    enabled: !!user,
  });

  console.log(`[cert-ui] User: ${user?.id}, CertId: ${certId}, Items Count: ${itemsQuery.data?.data?.length ?? 0}`);
  if (itemsQuery.data?.data) {
    console.log(`[cert-ui] Items:`, itemsQuery.data.data.slice(0, 5));
  }

  const certify = useMutation({
    mutationFn: (item: CertificationItem) => certificationApi.certifyItem({
      itemId: item.id,
      campaignId: item.certification_id,
      userId: item.user_id,
      resourceId: item.application_id,
      comment: 'Certified via My Tasks'
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['certItems'] });
      toast.success('Item certified');
    },
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['certItems'] });
      toast.success('Access revoked');
      setRevokeTarget(null);
      setRevokeReason('');
    },
    onError: () => toast.error('Failed to revoke'),
  });

  const items = itemsQuery.data?.data ?? [];
  const pendingItems = items.filter(i => i.decision === 'PENDING');

  const bulkCertify = async () => {
    for (const id of selected) {
      const item = items.find(i => i.id === id);
      if (item) {
        await certificationApi.certifyItem({
          itemId: item.id,
          campaignId: item.certification_id,
          userId: item.user_id,
          resourceId: item.application_id
        });
      }
    }
    qc.invalidateQueries({ queryKey: ['certItems'] });
    toast.success(`${selected.length} items certified`);
    setSelected([]);
  };

  const columns: Column<CertificationItem>[] = [
    {
      key: 'select', header: '',
      render: (item) => item.decision === 'PENDING' ? (
        <input type="checkbox" checked={selected.includes(item.id)} onChange={e => setSelected(s => e.target.checked ? [...s, item.id] : s.filter(x => x !== item.id))} />
      ) : null,
      width: '40px',
    },
    { key: 'user', header: 'User', render: i => <span className="font-medium">{i.user_name}</span> },
    { key: 'app', header: 'Application', render: i => i.application_name },
    { key: 'decision', header: 'Decision', render: i => <StatusBadge status={i.decision} /> },
    {
      key: 'risk', header: 'Risk Score',
      render: (i) => {
        const score = i.risk_score !== null ? Math.round(i.risk_score) : null;
        const level = score === null ? '' : (score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low');
        return (
          <div className="risk-score" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="risk-bar" style={{ width: 60, height: 6 }}>
              <div className={`risk-fill ${level}`} style={{ width: `${score ?? 0}%` }} />
            </div>
            {score !== null ? (
              <span className={`badge badge-${level}`} style={{ minWidth: '45px', textAlign: 'center', fontWeight: 700 }}>
                {score}%
              </span>
            ) : (
              <span className="text-xs text-muted">N/A</span>
            )}
          </div>
        );
      },
      width: '160px'
    },
    {
      key: 'recommendation', header: 'AI Recommendation',
      render: (i) => i.recommended_action ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Sparkles size={14} style={{ color: '#7c3aed' }} />
          <span className={`badge badge-${i.recommended_action === 'RETAIN' ? 'low' : 'medium'}`} style={{ fontSize: '0.7rem', fontWeight: 700 }}>
            {i.recommended_action}
          </span>
        </div>
      ) : <span className="text-xs text-muted">Analyzing…</span>
    },
    {
      key: 'actions', header: 'Actions',
      render: (i) => i.decision === 'PENDING' ? (
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

  return (
    <div>
      <PageHeader 
        title="My Certification Tasks" 
        subtitle={
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span>Reviewing {itemsQuery.data?.meta?.total || pendingItems.length} pending items</span>
            {activeCert && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: '#f59e0b' }}>
                <span className="pulse" style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'currentColor' }} />
                Deadline: {new Date(activeCert.end_date).toLocaleDateString()}
                {(() => {
                  const diff = new Date(activeCert.end_date).getTime() - Date.now();
                  if (diff <= 0) return ' (Expired)';
                  const days = Math.floor(diff / (80000000)); // Rough estimate for quick display
                  return ` (${Math.max(1, Math.floor(diff/(1000*60*60*24)))}d remaining)`;
                })()}
              </div>
            )}
          </div>
        }
      />

      {pendingItems.length > 0 && selected.length > 0 && (
        <div className="alert alert-info" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{selected.length} item(s) selected</span>
          <button className="btn btn-sm btn-primary" onClick={bulkCertify}>Bulk Certify Selected</button>
        </div>
      )}

      <DataTable
        columns={columns}
        data={pendingItems}
        loading={itemsQuery.isLoading || certsQuery.isLoading}
        totalPages={itemsQuery.data?.meta?.total_pages ?? 1}
        currentPage={page}
        total={pendingItems.length}
        perPage={perPage}
        onPageChange={setPage}
        emptyTitle="No certification tasks"
        emptyDesc="You have no pending review items"
      />

      {revokeTarget && (
        <div className="modal-overlay" onClick={() => setRevokeTarget(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Revoke Access</h2>
              <button className="btn-icon" onClick={() => setRevokeTarget(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p className="text-sm text-muted" style={{ marginBottom: 12 }}>
                Revoke <strong>{revokeTarget.application_name}</strong> from {revokeTarget.user_name}?
              </p>
              <div className="form-group">
                <label className="form-label required">Reason</label>
                <textarea className="form-control" value={revokeReason} onChange={e => setRevokeReason(e.target.value)} placeholder="Reason for revocation…" />
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
