import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { X, Sparkles, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeader } from '../../components/layout/PageHeader';
import { DataTable, type Column } from '../../components/shared/DataTable';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { certificationApi } from '../../api/certification.api';
import { usePagination } from '../../hooks/usePagination';
import { useAuth } from '../../hooks/useAuth';
import { formatDate } from '../../lib/utils';
import type { CertificationItem } from '../../types/certification.types';
import { AIChatbot } from '../ai/AIChatbot';

export function MyCertificationTasksPage() {
  const { user } = useAuth();
  const { campaignId } = useParams<{ campaignId: string }>();
  const { page, perPage, setPage } = usePagination();
  const [revokeTarget, setRevokeTarget] = useState<CertificationItem | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const qc = useQueryClient();
  const isCampaignDetail = !!campaignId;

  // Get first active cert to show tasks from (only when not viewing a specific campaign)
  const certsQuery = useQuery({
    queryKey: ['certifications', { status: 'ACTIVE' }],
    queryFn: () => certificationApi.list({ status: 'ACTIVE' }),
    enabled: !isCampaignDetail,
  });
  const activeCert = certsQuery.data?.data?.[0];
  const certId = activeCert?.id;

  // When viewing a specific campaign, fetch campaign metadata
  const certDetailQuery = useQuery({
    queryKey: ['certifications', campaignId],
    queryFn: () => certificationApi.get(campaignId!),
    enabled: isCampaignDetail,
  });
  const campaignDetail = certDetailQuery.data?.data;

  const itemsQuery = useQuery({
    queryKey: ['certItems', { reviewer_id: user?.id, campaignId, page }],
    queryFn: () => certificationApi.listItems(campaignId, { reviewer_id: user!.id, page, per_page: perPage }),
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
      toast.success('Item kept');
    },
    onError: () => toast.error('Failed to keep'),
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
  // When viewing a specific campaign, show ALL items; otherwise only pending
  const displayItems = isCampaignDetail ? items : pendingItems;

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
    toast.success(`${selected.length} items kept`);
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
            {certify.isPending && certify.variables?.user_id === i.user_id && certify.variables?.application_id === i.application_id ? <span className="spinner spinner-sm" /> : 'Keep'}
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
        title={isCampaignDetail ? (campaignDetail?.name || "Campaign Review Details") : "My Certification Tasks"} 
        subtitle={
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span>
              {isCampaignDetail 
                ? `${items.length} total items — ${pendingItems.length} pending review`
                : `Reviewing ${itemsQuery.data?.meta?.total || pendingItems.length} pending items`
              }
            </span>
            {!isCampaignDetail && activeCert && (
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
        breadcrumbs={isCampaignDetail ? [
          { label: 'Campaign History', to: '/supervisor/certifications/history' },
          { label: campaignDetail?.name || 'Campaign Details' }
        ] : undefined}
        actions={
          isCampaignDetail ? (
            <Link to="/supervisor/certifications/history" className="btn btn-secondary">← Back to History</Link>
          ) : undefined
        }
      />

      {/* Campaign metadata card when viewing a specific campaign */}
      {isCampaignDetail && campaignDetail && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <div className="text-xs text-muted font-semibold" style={{ textTransform: 'uppercase' }}>Status</div>
              <div style={{ marginTop: 4 }}><StatusBadge status={campaignDetail.status} /></div>
            </div>
            <div>
              <div className="text-xs text-muted font-semibold" style={{ textTransform: 'uppercase' }}>Period</div>
              <div className="text-sm" style={{ marginTop: 4 }}>
                {formatDate(campaignDetail.start_date || campaignDetail.created_at)} — {formatDate(campaignDetail.end_date)}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              {(() => {
                const pct = campaignDetail.total_items > 0 
                  ? Math.round(((campaignDetail.certified_count + campaignDetail.revoked_count) / campaignDetail.total_items) * 100) 
                  : 0;
                return (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span className="text-xs text-muted">Completion</span>
                      <span className="text-xs font-semibold">{pct}%</span>
                    </div>
                    <div className="progress-bar"><div className="progress-bar-fill" style={{ width: `${pct}%` }} /></div>
                    <div className="text-xs text-muted" style={{ marginTop: 4 }}>
                      {campaignDetail.certified_count} certified · {campaignDetail.revoked_count} revoked · {campaignDetail.pending_count} pending
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {displayItems.some(i => i.decision === 'PENDING') && selected.length > 0 && (
        <div className="alert alert-info" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{selected.length} item(s) selected</span>
          <button className="btn btn-sm btn-primary" onClick={bulkCertify}>Bulk Keep Selected</button>
        </div>
      )}

      <DataTable
        columns={columns}
        data={displayItems}
        loading={itemsQuery.isLoading || certsQuery.isLoading || certDetailQuery.isLoading}
        totalPages={itemsQuery.data?.meta?.total_pages ?? 1}
        currentPage={page}
        total={displayItems.length}
        perPage={perPage}
        onPageChange={setPage}
        emptyTitle={isCampaignDetail ? "No items in this campaign" : "No certification tasks"}
        emptyDesc={isCampaignDetail ? "No certification items found for this campaign" : "You have no pending review items"}
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
