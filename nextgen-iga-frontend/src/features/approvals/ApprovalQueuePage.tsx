import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search, Check, X, Eye, Zap, ShieldCheck, ShieldQuestion, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeader } from '../../components/layout/PageHeader';
import { DataTable, type Column } from '../../components/shared/DataTable';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { requestsApi } from '../../api/requests.api';
import { usePagination } from '../../hooks/usePagination';
import { formatDate } from '../../lib/utils';
import type { AccessRequest } from '../../types/request.types';
import { useAuth } from '../../hooks/useAuth';
import { igaRecommendationApi } from '../../api/iga-recommendation.api';
import type { ManagerReviewResult } from '../../types/recommendation.types';

export function ApprovalQueuePage() {
  const { page, perPage, setPage } = usePagination();
  const [search, setSearch] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectOpen, setRejectOpen] = useState<string | null>(null);
  const qc = useQueryClient();

  const { user } = useAuth();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['approvals', { page }],
    queryFn: () => requestsApi.list({ page, per_page: perPage, status: 'PENDING' }),
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

  const approve = useMutation({
    mutationFn: (id: string) => requestsApi.approve(id, {}),
    onMutate: (id) => setActionId(id),
    onSuccess: () => {
      toast.success('Request approved');
      qc.invalidateQueries({ queryKey: ['approvals'] });
    },
    onError: () => toast.error('Failed to approve'),
    onSettled: () => setActionId(null),
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      requestsApi.reject(id, { reason }),
    onSuccess: () => {
      toast.success('Request rejected');
      qc.invalidateQueries({ queryKey: ['approvals'] });
      setRejectOpen(null);
      setRejectReason('');
    },
    onError: () => toast.error('Failed to reject'),
  });

  const rows = (data?.data ?? []) as AccessRequest[];

  const filtered = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter(r => 
      r.user_name?.toLowerCase().includes(q) || 
      r.application_name?.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const columns: Column<AccessRequest>[] = [
    {
      key: 'requester',
      header: 'Requester',
      render: (r) => <span className="font-medium">{r.user_name}</span>,
    },
    {
      key: 'application',
      header: 'Application',
      render: (r) => r.application_name,
    },
    {
      key: 'submitted',
      header: 'Submitted',
      render: (r) => formatDate(r.submitted_at),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: 'recommendation', header: 'Governance Advice',
      render: (i) => {
        const targetUser = i.target_user_id || i.user_id;
        const key = `${targetUser}-${i.application_name}`.toLowerCase();
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
        const targetUser = i.target_user_id || i.user_id;
        const key = `${targetUser}-${i.application_name}`.toLowerCase();
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
      key: 'actions',
      header: 'Actions',
      render: (r) => (
        <div style={{ display: 'flex', gap: 6 }}>
          <Link 
            to={`/supervisor/approvals/${r.id}`} 
            className="btn btn-sm btn-secondary"
            title="View Details"
          >
            <Eye size={12} /> View
          </Link>
          <button
            className="btn btn-sm btn-primary"
            disabled={approve.isPending && actionId === r.id}
            onClick={() => approve.mutate(r.id)}
          >
            {approve.isPending && actionId === r.id ? <span className="spinner" /> : <Check size={12} />}
            Approve
          </button>
          <button
            className="btn btn-sm btn-danger"
            onClick={() => { setRejectOpen(r.id); setRejectReason(''); }}
          >
            <X size={12} /> Reject
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Approval Queue"
        subtitle="Requests pending your decision"
        actions={null}
      />

      <div className="filters-bar">
        <div className="search-input-wrap">
          <Search size={14} />
          <input className="form-control" placeholder="Search requests…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {isError ? (
        <div className="error-state">
          <div className="error-state-title">Failed to load approvals</div>
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
          emptyTitle="No pending approvals"
          emptyDesc="All caught up! No requests are waiting for your review."
        />
      )}

      {/* Reject Modal */}
      {rejectOpen && (
        <div className="modal-overlay" onClick={() => setRejectOpen(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Reject Request</h2>
              <button className="btn-icon" onClick={() => setRejectOpen(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label required">Reason for rejection</label>
                <textarea
                  className="form-control"
                  placeholder="Explain why this request is being rejected…"
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setRejectOpen(null)}>Cancel</button>
              <button
                className="btn btn-danger"
                disabled={!rejectReason.trim() || reject.isPending}
                onClick={() => reject.mutate({ id: rejectOpen, reason: rejectReason })}
              >
                {reject.isPending ? <span className="spinner" /> : null}
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
