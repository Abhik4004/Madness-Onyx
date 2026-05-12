import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { X, Sparkles, Download, Zap } from 'lucide-react';
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
import { igaRecommendationApi } from '../../api/iga-recommendation.api';
import type { ManagerReviewResult } from '../../types/recommendation.types';
import { ShieldAlert, ShieldCheck, ShieldQuestion, Info } from 'lucide-react';

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

  const managerReview = useQuery({
    queryKey: ['iga-recommendations', 'manager-review', user?.id],
    queryFn: () => igaRecommendationApi.getManagerReview(user!.id),
    enabled: !!user,
  });

  const recommendationsMap = (managerReview.data?.results || []).reduce((acc: any, rec: ManagerReviewResult) => {
    const key = `${rec.user_id}-${rec.access_type}`.toLowerCase();
    acc[key] = rec.recommendation;
    return acc;
  }, {});

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
  const displayItems = items;

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
    ...(!isCampaignDetail ? [{ 
      key: 'campaign', 
      header: 'Campaign', 
      render: (i: any) => <span className="text-xs font-bold text-muted">{i.certification_name || 'Global'}</span> 
    }] : []),
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
      key: 'recommendation', header: 'Governance Advice',
      render: (i) => {
        const key = `${i.user_id}-${i.application_name}`.toLowerCase();
        const rec = recommendationsMap[key];
        
        if (!rec) return <span className="text-xs text-muted">No peer data</span>;

        const color = rec.decision === 'STRONGLY_RECOMMEND' ? '#22c55e' : rec.decision === 'RECOMMEND_WITH_CAUTION' ? '#f59e0b' : '#ef4444';
        const Icon = rec.decision === 'STRONGLY_RECOMMEND' ? ShieldCheck : rec.decision === 'RECOMMEND_WITH_CAUTION' ? ShieldQuestion : ShieldAlert;

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 220 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ 
                background: `${color}15`, 
                color: color, 
                padding: 4, 
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Icon size={14} />
              </div>
              <span className="font-black" style={{ color: color, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {rec.decision.replace(/_/g, ' ')}
              </span>
              <span className="text-xs font-bold" style={{ color: 'var(--color-gray-400)' }}>{rec.confidence}%</span>
            </div>
            <div className="text-xs font-medium" style={{ fontSize: '0.7rem', lineHeight: 1.4, color: 'var(--color-gray-600)', background: 'var(--color-gray-50)', padding: '6px 10px', borderRadius: 8 }}>
              {rec.reason}
            </div>
            {rec.decision === 'DO_NOT_RECOMMEND' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Zap size={10} fill="#ef4444" color="#ef4444" />
                <span style={{ fontSize: '0.6rem', color: '#ef4444', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Risk Alert: Excess Access
                </span>
              </div>
            )}
          </div>
        );
      }
    },
    {
      key: 'peerAdoption', header: 'Peer Adoption',
      render: (i) => {
        const key = `${i.user_id}-${i.application_name}`.toLowerCase();
        const rec = recommendationsMap[key];
        if (!rec) return <span className="text-muted">—</span>;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 100 }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="text-[10px] font-black text-muted">TEAM</span>
                <span className="text-[10px] font-black">{rec.breakdown.same_manager.percentage}</span>
             </div>
             <div className="adoption-bar-container" style={{ height: 4 }}>
                <div className="adoption-bar-fill" style={{ width: rec.breakdown.same_manager.percentage, background: 'var(--color-primary)' }} />
             </div>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                <span className="text-[10px] font-black text-muted">ORG</span>
                <span className="text-[10px] font-black">{rec.breakdown.different_manager.percentage}</span>
             </div>
             <div className="adoption-bar-container" style={{ height: 4 }}>
                <div className="adoption-bar-fill" style={{ width: rec.breakdown.different_manager.percentage, background: 'var(--color-gray-300)' }} />
             </div>
          </div>
        );
      }
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
                ? `${items.length} total items`
                : `Reviewing ${itemsQuery.data?.meta?.total || items.length} total items`
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
