import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeader } from '../../components/layout/PageHeader';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { requestsApi } from '../../api/requests.api';
import { recommendationsApi } from '../../api/recommendations.api';
import { formatDate } from '../../lib/utils';
import { TimeBasedProgress } from '../access-requests/components/TimeBasedProgress';

export function ApprovalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [comment, setComment] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['requests', id],
    queryFn: () => requestsApi.get(id!),
    enabled: !!id,
  });

  const req = data?.data;

  const riskProfile = useQuery({
    queryKey: ['risk', req?.user_id],
    queryFn: () => recommendationsApi.getRiskProfile(req!.user_id!),
    enabled: !!req?.user_id,
  });

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

  const risk = riskProfile.data?.data;

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

          {/* Risk Profile */}
          {risk && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">Requester Risk Profile</span>
                <span className={`badge badge-${risk.risk_level.toLowerCase()}`}>{risk.risk_level}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="risk-score">
                  <span className="text-xs text-muted" style={{ width: 100 }}>Risk Score</span>
                  <div className="risk-bar">
                    <div className={`risk-fill ${risk.risk_level.toLowerCase()}`} style={{ width: `${risk.overall_score}%` }} />
                  </div>
                  <span className="text-sm font-semibold">{risk.overall_score}/100</span>
                </div>
                {risk.factors.map((f) => (
                  <div key={f.name} style={{ fontSize: '0.8rem' }}>
                    <span className="font-medium">{f.name}</span>
                    <span className="text-muted"> — {f.description}</span>
                  </div>
                ))}
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
