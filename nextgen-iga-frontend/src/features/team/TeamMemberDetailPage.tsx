import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeader } from '../../components/layout/PageHeader';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { DataTable, type Column } from '../../components/shared/DataTable';
import { usersApi } from '../../api/users.api';
import { provisionApi } from '../../api/provision.api';
import { formatDate } from '../../lib/utils';
import type { UserAccess } from '../../types/provision.types';

export function TeamMemberDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const qc = useQueryClient();
  const [revokeTarget, setRevokeTarget] = useState<UserAccess | null>(null);
  const [revokeReason, setRevokeReason] = useState('');

  const { data: userRes, isLoading: userLoading } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => usersApi.get(userId!),
    enabled: !!userId,
  });

  const { data: accessRes, isLoading: accessLoading } = useQuery({
    queryKey: ['userAccess', userId],
    queryFn: () => provisionApi.getUserAccess(userId!),
    enabled: !!userId,
  });

  const revoke = useMutation({
    mutationFn: (access: UserAccess) =>
      provisionApi.revoke({
        user_id: access.user_id,
        application_id: access.application_id,
        role_id: access.role_id,
        reason: revokeReason,
      }),
    onSuccess: () => {
      toast.success('Access revoke initiated');
      qc.invalidateQueries({ queryKey: ['userAccess', userId] });
      setRevokeTarget(null);
    },
    onError: () => toast.error('Failed to revoke access'),
  });

  const user = userRes?.data;
  const accesses = accessRes?.data ?? [];

  const columns: Column<UserAccess>[] = [
    { key: 'app', header: 'Application', render: a => <span className="font-medium">{a.application_name}</span> },
    { key: 'role', header: 'Role', render: a => a.role_name },
    { key: 'status', header: 'Status', render: a => <StatusBadge status={a.status} /> },
    { key: 'granted', header: 'Granted', render: a => formatDate(a.granted_at) },
    { key: 'expires', header: 'Expires', render: a => a.expires_at ? formatDate(a.expires_at) : 'Never' },
    {
      key: 'actions', header: '', width: '80px',
      render: a => (
        <button className="btn btn-sm btn-danger" onClick={() => { setRevokeTarget(a); setRevokeReason(''); }}>
          Revoke
        </button>
      ),
    },
  ];

  if (userLoading) return <div className="card"><div className="skeleton" style={{ height: 200 }} /></div>;
  if (!user) return (
    <div className="error-state">
      <AlertTriangle size={32} className="error-state-icon" />
      <div className="error-state-title">User not found</div>
      <Link to="/supervisor/team" className="btn btn-secondary">← Back</Link>
    </div>
  );

  return (
    <div>
      <PageHeader
        title={user.full_name}
        subtitle={user.email}
        breadcrumbs={[{ label: 'My Team', to: '/supervisor/team' }, { label: user.full_name }]}
      />

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div><div className="text-xs text-muted font-semibold" style={{ textTransform: 'uppercase' }}>Role</div><div className="text-sm font-medium" style={{ marginTop: 4 }}>{user.role.replace('_', ' ')}</div></div>
          <div><div className="text-xs text-muted font-semibold" style={{ textTransform: 'uppercase' }}>Status</div><div style={{ marginTop: 4 }}><StatusBadge status={user.status} /></div></div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Active Access ({accesses.filter(a => a.status === 'ACTIVE').length})</span>
        </div>
        <DataTable
          columns={columns}
          data={accesses}
          loading={accessLoading}
          emptyTitle="No active access"
          emptyDesc="This user has no provisioned access"
        />
      </div>

      {revokeTarget && (
        <div className="modal-overlay" onClick={() => setRevokeTarget(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Revoke Access</h2>
            </div>
            <div className="modal-body">
              <p className="text-sm text-muted" style={{ marginBottom: 16 }}>
                Revoke <strong>{revokeTarget.application_name} — {revokeTarget.role_name}</strong> from {user.full_name}?
              </p>
              <div className="form-group">
                <label className="form-label required">Reason</label>
                <textarea className="form-control" placeholder="Reason for revocation…" value={revokeReason} onChange={e => setRevokeReason(e.target.value)} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setRevokeTarget(null)}>Cancel</button>
              <button className="btn btn-danger" disabled={!revokeReason.trim() || revoke.isPending} onClick={() => revoke.mutate(revokeTarget)}>
                {revoke.isPending ? <span className="spinner" /> : null} Revoke
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
