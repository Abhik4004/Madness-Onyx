import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { AlertTriangle, X, Clock, ShieldCheck, ShieldAlert, History as HistoryIcon, Calendar, User, UserCheck, MessageSquare, Timer, Database } from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeader } from '../../components/layout/PageHeader';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { requestsApi } from '../../api/requests.api';
import { formatDate, formatDateTime, formatRelative } from '../../lib/utils';

export function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['requests', id],
    queryFn: () => requestsApi.get(id!),
    enabled: !!id,
    refetchInterval: (query) => {
      const status = query.state.data?.data?.status;
      // Stop polling if request is in a final state (APPROVED, REJECTED, EXPIRED, REVOKED)
      // Actually, APPROVED might transition to ACTIVE/PROVISIONED, so we keep polling if not terminal.
      if (['REJECTED', 'EXPIRED', 'REVOKED', 'ACTIVE'].includes(status ?? '')) return false;
      return 5000; // Poll every 5s for pending/approved
    }
  });

  const req = data?.data;

  // Countdown timer effect
  useEffect(() => {
    if (req?.status !== 'ACTIVE' || !req?.valid_till) {
      setTimeLeft(null);
      return;
    }

    const timer = setInterval(() => {
      const now = new Date().getTime();
      const end = new Date(req.valid_till!).getTime();
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft('EXPIRED');
        qc.invalidateQueries({ queryKey: ['requests', id] });
        clearInterval(timer);
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [req?.status, req?.valid_till, id, qc]);

  const cancel = useMutation({
    mutationFn: () => requestsApi.cancel(id!),
    onSuccess: () => {
      toast.success('Request cancelled');
      qc.invalidateQueries({ queryKey: ['requests'] });
      setCancelOpen(false);
    },
    onError: () => toast.error('Failed to cancel request'),
  });

  if (isLoading) {
    return (
      <div className="fade-in">
        <div className="skeleton w-1/3 mb-6" style={{ height: 40 }} />
        <div className="grid-2" style={{ gap: 20 }}>
          <div className="skeleton h-64" />
          <div className="skeleton h-64" />
        </div>
      </div>
    );
  }

  if (isError || !req) {
    return (
      <div className="error-state fade-in">
        <AlertTriangle size={48} className="text-danger mb-4" />
        <h2 className="text-xl font-bold">Request Not Found</h2>
        <p className="text-muted mb-6">The access request you are looking for does not exist or has been removed.</p>
        <Link to="/requests" className="btn btn-primary">Back to My Requests</Link>
      </div>
    );
  }

  const timelineEvents = [
    { label: 'Request Submitted', date: req.submitted_at, type: 'active', icon: <Clock size={14} /> },
    ...(req.decided_at ? [{ 
      label: req.status === 'REJECTED' ? 'Request Rejected' : 'Request Approved', 
      date: req.decided_at, 
      type: req.status === 'REJECTED' ? 'danger' : 'success', 
      icon: req.status === 'REJECTED' ? <ShieldAlert size={14} /> : <ShieldCheck size={14} />,
      comment: req.approver_comment || req.rejection_reason 
    }] : []),
    ...(req.activated_at || req.provisioned_at ? [{ label: 'Access Activated', date: req.activated_at || req.provisioned_at, type: 'success', icon: <ShieldCheck size={14} /> }] : []),
    ...(req.revoked_at ? [{ label: 'Access Revoked', date: req.revoked_at, type: 'danger', icon: <X size={14} /> }] : []),
  ];

  return (
    <div className="fade-in">
      <PageHeader
        title={req.application_name || req.resourceId}
        subtitle={`Request ID: ${req.id || req.requestId}`}
        breadcrumbs={[{ label: 'My Requests', to: '/requests' }, { label: 'Details' }]}
        actions={
          ['PENDING', 'PENDING_APPROVAL'].includes(req.status) && (
            <button className="btn btn-outline-danger btn-sm" onClick={() => setCancelOpen(true)}>
              <X size={14} /> Cancel Request
            </button>
          )
        }
      />

      <div className="grid-12" style={{ gap: 24, alignItems: 'start' }}>
        {/* Main Status & Details */}
        <div className="span-8 space-y-6">
          <div className="card shadow-sm border-0">
            <div className="card-header bg-transparent border-0 flex justify-between items-center">
              <span className="card-title text-lg flex items-center gap-2">
                <ShieldCheck size={18} className="text-primary" /> Request Status
              </span>
              <StatusBadge status={req.status} />
            </div>
            
            {/* Status-specific Alerts */}
            {req.status === 'ACTIVE' && (
              <div className="alert alert-success mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Timer className="animate-pulse" size={20} />
                  <div>
                    <div className="font-bold">Access is currently ACTIVE</div>
                    <div className="text-xs">Your privileged access is provisioned and ready for use.</div>
                  </div>
                </div>
                {timeLeft && (
                  <div className="text-right">
                    <div className="text-xs uppercase font-bold tracking-wider opacity-75">Expires In</div>
                    <div className="font-mono text-lg font-bold">{timeLeft}</div>
                  </div>
                )}
              </div>
            )}

            {req.status === 'PENDING_APPROVAL' && (
              <div className="alert alert-info mb-6 flex items-center gap-3">
                <Clock size={20} />
                <div>
                  <div className="font-bold">Pending Review</div>
                  <div className="text-xs">Waiting for {req.approver_name || 'assigned manager'} to review your request.</div>
                </div>
              </div>
            )}

            {req.status === 'REJECTED' && (
              <div className="alert alert-danger mb-6 flex items-center gap-3">
                <ShieldAlert size={20} />
                <div>
                  <div className="font-bold">Access Denied</div>
                  <div className="text-xs">{req.rejection_reason || 'This request was rejected during the approval process.'}</div>
                </div>
              </div>
            )}

            <div className="grid-2" style={{ gap: 20 }}>
              <div className="space-y-4">
                <DetailItem label="Resource" value={req.application_name ?? req.resourceId} icon={<Database size={14} />} />
                <DetailItem label="Role" value={req.role_name ?? ''} icon={<ShieldCheck size={14} />} />
                <DetailItem label="Target User" value={req.target_user_name || req.user_name || ''} icon={<UserCheck size={14} />} />
                <DetailItem label="Justification" value={req.justification} icon={<MessageSquare size={14} />} fullWidth />
              </div>
              <div className="space-y-4 border-left pl-6">
                <DetailItem label="Submitted At" value={formatDateTime(req.submitted_at)} icon={<Calendar size={14} />} />
                {req.valid_from && <DetailItem label="Valid From" value={formatDateTime(req.valid_from)} icon={<Clock size={14} />} />}
                {req.valid_till && <DetailItem label="Valid Till" value={formatDateTime(req.valid_till)} icon={<Clock size={14} />} />}
                {req.revoked_at && <DetailItem label="Revoked At" value={formatDateTime(req.revoked_at)} icon={<X size={14} />} />}
              </div>
            </div>
          </div>

          {/* Detailed Metadata */}
          <div className="card shadow-sm border-0">
            <div className="card-header bg-transparent border-0">
              <span className="card-title text-lg flex items-center gap-2">
                <ShieldCheck size={18} className="text-primary" /> Approval Metadata
              </span>
            </div>
            <div className="grid-2" style={{ gap: 20 }}>
              <div className="space-y-4">
                <DetailItem label="Approver" value={req.approver_name || 'System Auto-Route'} icon={<User size={14} />} />
                <DetailItem label="Decision" value={req.status === 'PENDING_APPROVAL' ? 'Waiting' : req.status === 'REJECTED' ? 'Denied' : 'Approved'} />
              </div>
              <div className="space-y-4 border-left pl-6">
                <DetailItem label="Approval Date" value={req.decided_at ? formatDateTime(req.decided_at) : '---'} icon={<Calendar size={14} />} />
                <DetailItem label="Decision Note" value={req.approver_comment || '---'} icon={<MessageSquare size={14} />} />
              </div>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="span-4">
          <div className="card shadow-sm border-0 sticky-top" style={{ top: 20 }}>
            <div className="card-header bg-transparent border-0 flex items-center gap-2">
              <HistoryIcon size={18} className="text-primary" />
              <span className="card-title">Activity Timeline</span>
            </div>
            <div className="timeline mt-4">
              {timelineEvents.map((ev, i) => (
                <div key={i} className="timeline-item">
                  <div className={`timeline-dot ${ev.type}`} />
                  <div className="timeline-content">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-primary opacity-70">{ev.icon}</span>
                      <span className="timeline-label font-bold text-sm">{ev.label}</span>
                    </div>
                    <div className="timeline-meta text-xs">{formatRelative(ev.date)}</div>
                    {ev.comment && <div className="timeline-comment mt-2 bg-gray-50 p-2 rounded text-xs border-left-primary italic">"{ev.comment}"</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={cancelOpen}
        title="Cancel Request"
        message="Are you sure you want to cancel this access request? This action cannot be undone."
        confirmLabel="Cancel Request"
        danger
        loading={cancel.isPending}
        onConfirm={() => cancel.mutate()}
        onCancel={() => setCancelOpen(false)}
      />
    </div>
  );
}

function DetailItem({ label, value, icon, fullWidth }: { label: string, value: string, icon?: React.ReactNode, fullWidth?: boolean }) {
  return (
    <div className={`${fullWidth ? 'col-span-full' : ''} space-y-1`}>
      <div className="text-xs text-muted font-bold uppercase tracking-wider flex items-center gap-2">
        {icon}
        {label}
      </div>
      <div className="text-sm font-medium text-gray-900 leading-relaxed">{value}</div>
    </div>
  );
}
