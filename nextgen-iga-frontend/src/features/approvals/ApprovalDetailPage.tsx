import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, X, Zap, ShieldCheck, ShieldQuestion, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeader } from '../../components/layout/PageHeader';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { requestsApi } from '../../api/requests.api';
import { formatDate } from '../../lib/utils';
import { TimeBasedProgress } from '../access-requests/components/TimeBasedProgress';
import { useAuth } from '../../hooks/useAuth';
import { igaRecommendationApi } from '../../api/iga-recommendation.api';
import type { ManagerReviewResult } from '../../types/recommendation.types';

export function ApprovalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [comment, setComment] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);
  const { user } = useAuth();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['requests', id],
    queryFn: () => requestsApi.get(id!),
    enabled: !!id,
  });

  const req = data?.data;

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

  let rec = null;
  if (req) {
    const targetUser = req.target_user_id || req.user_id;
    const key = `${targetUser}-${req.application_name}`.toLowerCase();
    rec = recommendationsMap[key];
  }

  // Old risk profile removed
  const risk = null;

  const approve = useMutation({
    mutationFn: () => requestsApi.approve(id!, { comment: comment || undefined }),
    onSuccess: () => {
      toast.success('Request approved');
      qc.invalidateQueries({ queryKey: ['approvals'] });
      navigate('/supervisor/approvals');
    },
    onError: () => toast.error('Failed to approve'),
  });

  const reject = useMutation({
    mutationFn: () => requestsApi.reject(id!, { reason: rejectReason }),
    onSuccess: () => {
      toast.success('Request rejected');
      qc.invalidateQueries({ queryKey: ['approvals'] });
      navigate('/supervisor/approvals');
    },
    onError: () => toast.error('Failed to reject'),
  });

  if (isLoading) return <div className="card"><div className="skeleton skeleton-text w-full" style={{ height: 200 }} /></div>;
  if (isError || !req) return (
    <div className="error-state">
      <AlertTriangle size={32} className="error-state-icon" />
      <div className="error-state-title">Request not found</div>
      <Link to="/supervisor/approvals" className="btn btn-secondary">← Back</Link>
    </div>
  );


  return (
    <div>
      <PageHeader
        title="Review Request"
        breadcrumbs={[{ label: 'Approval Queue', to: '/supervisor/approvals' }, { label: 'Review' }]}
      />

      <div className="grid-2" style={{ gap: 20, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Request Info */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Request Details</span>
              <StatusBadge status={(() => {
                // @ts-ignore
                if (req.decided_at && req.duration_seconds && (req.status === 'APPROVED' || req.status === 'PROVISIONED')) {
                  // @ts-ignore
                  const expiryTime = new Date(req.decided_at).getTime() + (req.duration_seconds * 1000);
                  if (Date.now() > expiryTime) return 'EXPIRED';
                }
                return req.status;
              })()} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Requester', value: req.user_name },
                { label: 'Application', value: req.application_name },
                { label: 'Entitlement', value: req.role_name },
                { label: 'Justification', value: req.justification },
                { label: 'Submitted', value: formatDate(req.submitted_at) },
                { 
                  label: req.status === 'PENDING' ? 'Requested Duration' : 'Time Remaining', 
                  value: (
                    <TimeBasedProgress 
                      decidedAt={req.decided_at} 
                      // @ts-ignore
                      durationSeconds={req.duration_seconds || null} 
                      status={req.status} 
                    />
                  ) 
                },
              ].filter(Boolean).map((item) => (
                <div key={item!.label} style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 8, paddingBottom: 10, borderBottom: '1px solid var(--color-gray-100)' }}>
                  <span className="text-xs text-muted font-semibold" style={{ textTransform: 'uppercase', letterSpacing: '0.4px', paddingTop: 2 }}>{item!.label}</span>
                  <span className="text-sm">{item!.value}</span>
                </div>
              ))}
            </div>
          </div>



        {rec && (
          <div className="card glass">
            <div className="card-header">
              <span className="card-title">Governance Insight</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {(() => {
                const color = rec.decision === 'STRONGLY_RECOMMEND' ? '#22c55e' : rec.decision === 'RECOMMEND_WITH_CAUTION' ? '#f59e0b' : '#ef4444';
                const Icon = rec.decision === 'STRONGLY_RECOMMEND' ? ShieldCheck : rec.decision === 'RECOMMEND_WITH_CAUTION' ? ShieldQuestion : ShieldAlert;
                return (
                  <div>
                    <div className="text-xs font-bold text-muted uppercase" style={{ marginBottom: 8 }}>Governance Advice</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <div style={{ background: `${color}15`, color: color, padding: 4, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon size={16} />
                      </div>
                      <span className="font-black" style={{ color: color, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {rec.decision.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs font-bold" style={{ color: 'var(--color-gray-400)' }}>{rec.confidence}% confidence</span>
                    </div>
                    <div className="text-sm font-medium" style={{ lineHeight: 1.5, color: 'var(--color-gray-700)', background: 'var(--color-gray-50)', padding: '10px 12px', borderRadius: 8 }}>
                      {rec.reason}
                    </div>
                    {rec.decision === 'DO_NOT_RECOMMEND' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                        <Zap size={14} fill="#ef4444" color="#ef4444" />
                        <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Risk Alert: Excess Access
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}

              <div>
                <div className="text-xs font-bold text-muted uppercase" style={{ marginBottom: 8 }}>Peer Adoption</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                   <div>
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span className="text-xs font-black text-muted">TEAM (Same Manager)</span>
                        <span className="text-xs font-black">{rec.breakdown.same_manager.percentage}</span>
                     </div>
                     <div className="adoption-bar-container" style={{ height: 6, borderRadius: 3, background: 'var(--color-gray-100)' }}>
                        <div className="adoption-bar-fill" style={{ width: rec.breakdown.same_manager.percentage, height: '100%', borderRadius: 3, background: 'var(--color-primary)' }} />
                     </div>
                   </div>
                   <div>
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, marginTop: 4 }}>
                        <span className="text-xs font-black text-muted">ORG (Different Manager)</span>
                        <span className="text-xs font-black">{rec.breakdown.different_manager.percentage}</span>
                     </div>
                     <div className="adoption-bar-container" style={{ height: 6, borderRadius: 3, background: 'var(--color-gray-100)' }}>
                        <div className="adoption-bar-fill" style={{ width: rec.breakdown.different_manager.percentage, height: '100%', borderRadius: 3, background: 'var(--color-gray-300)' }} />
                     </div>
                   </div>
                </div>
              </div>
            </div>
          </div>
        )}

        </div>

        {/* Decision */}
        {req.status === 'PENDING' && (
          <div className="card" style={{ position: 'sticky', top: 88 }}>
            <div className="card-header">
              <span className="card-title">Make Decision</span>
            </div>
            <div className="form-group">
              <label className="form-label">Comment (optional)</label>
              <textarea
                className="form-control"
                placeholder="Add an optional comment…"
                value={comment}
                onChange={e => setComment(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                className="btn btn-primary btn-full"
                disabled={approve.isPending}
                onClick={() => approve.mutate()}
              >
                {approve.isPending ? <span className="spinner" /> : null}
                Approve Request
              </button>
              <button
                className="btn btn-danger btn-full"
                onClick={() => setRejectOpen(true)}
              >
                Reject Request
              </button>
            </div>
          </div>
        )}
      </div>

      {rejectOpen && (
        <div className="modal-overlay" onClick={() => setRejectOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Reject Request</h2>
              <button className="btn-icon" onClick={() => setRejectOpen(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label required">Reason</label>
                <textarea
                  className="form-control"
                  placeholder="Provide a clear reason for rejection…"
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setRejectOpen(false)}>Cancel</button>
              <button
                className="btn btn-danger"
                disabled={!rejectReason.trim() || reject.isPending}
                onClick={() => reject.mutate()}
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
