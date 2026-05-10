import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Users, Shield, UserCheck, Layers, Mail, Crown } from 'lucide-react';
import toast from 'react-hot-toast';
import { useState } from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { DataTable, type Column } from '../../components/shared/DataTable';
import { usersApi } from '../../api/users.api';
import { applicationsApi, type Application } from '../../api/applications.api';
import { formatDate } from '../../lib/utils';
import type { UserAccess } from '../../types/provision.types';

export function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [addAccessOpen, setAddAccessOpen] = useState(false);

  /* ── Data fetching ─────────────────────────────────────────────────── */

  /**
   * GET /api/admin/users/:uid
   * → Gateway → LDAP backend
   */
  const userQuery = useQuery({
    queryKey: ['user', id],
    queryFn: () => usersApi.getDetails(id!),
    enabled: !!id,
    retry: false,
  });

  // Platform Entitlements (from Identity Service)
  const groups = userQuery.data?.data?.groups ?? [];
  const identityEntitlements = (userQuery.data?.data as any)?.entitlements ?? [];

  console.log(`[debug] Page loaded for ${id}:`, {
    groups: groups.length,
    identityEntitlements: identityEntitlements.length
  });

  const deactivate = useMutation({
    mutationFn: () => usersApi.deactivate(id!),
    onSuccess: () => {
      toast.success('User deactivated');
      qc.invalidateQueries({ queryKey: ['user', id] });
      setDeactivateOpen(false);
    },
    onError: () => toast.error('Failed to deactivate'),
  });

  const [roleOpen, setRoleOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>('');

  const approve = useMutation({
    mutationFn: () => usersApi.approveUser(id!),
    onSuccess: () => {
      toast.success('User approved successfully');
      qc.invalidateQueries({ queryKey: ['user', id] });
    },
    onError: () => toast.error('Failed to approve user'),
  });

  const updateRole = useMutation({
    mutationFn: (role: string) => usersApi.updateRole(id!, role as any),
    onSuccess: () => {
      toast.success('Role updated successfully');
      qc.invalidateQueries({ queryKey: ['user', id] });
      setRoleOpen(false);
    },
    onError: () => toast.error('Failed to update role'),
  });

  const user = userQuery.data?.data;

  const accessColumns: Column<UserAccess>[] = [
    { key: 'app', header: 'Application', render: a => a.application_name },
    { key: 'role', header: 'Role', render: a => a.role_name },
    { key: 'status', header: 'Status', render: a => <StatusBadge status={a.status} /> },
    { key: 'granted', header: 'Granted', render: a => formatDate(a.granted_at) },
    { key: 'expires', header: 'Expires', render: a => a.expires_at ? formatDate(a.expires_at) : 'Never' },
  ];

  /* ── Loading state ─────────────────────────────────────────────────── */
  if (userQuery.isLoading) {
    return (
      <div className="card">
        <div className="skeleton" style={{ height: 200 }} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="error-state">
        <AlertTriangle size={32} className="error-state-icon" />
        <div className="error-state-title">User not found</div>
        <Link to="/admin/users" className="btn btn-secondary">← Back</Link>
      </div>
    );
  }

  /* ── Role badge ────────────────────────────────────────────────────── */
  const roleBadge = (
    <span className={`badge badge-role-${user.role}`}>
      {user.role === 'admin' && <Crown size={10} />}
      {user.role === 'supervisor' && <Shield size={10} />}
      {user.role === 'end_user' && <UserCheck size={10} />}
      {user.role.replace(/_/g, ' ')}
    </span>
  );

  return (
    <div>
      <PageHeader
        title={user.full_name}
        breadcrumbs={[
          { label: 'Users', to: '/admin/users' },
          { label: user.full_name },
        ]}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            {user.status !== 'ACTIVE' && (
              <button 
                className="btn btn-primary btn-sm" 
                onClick={() => approve.mutate()} 
                disabled={approve.isPending}
                style={{ background: 'var(--grad-primary)', border: 'none' }}
              >
                {approve.isPending ? <span className="spinner" /> : <UserCheck size={14} style={{ marginRight: 6 }} />}
                Approve User
              </button>
            )}
            <button className="btn btn-secondary btn-sm" onClick={() => {
              setSelectedRole(user.role);
              setRoleOpen(true);
            }}>
              Edit Role
            </button>
            {user.role !== 'inactive' && (
              <button className="btn btn-danger btn-sm" onClick={() => setDeactivateOpen(true)}>
                Deactivate
              </button>
            )}
          </div>
        }
      />

      {/* ── Top info grid ──────────────────────────────────────────────── */}
      <div className="user-detail-grid">
        {/* Profile Card */}
        <div className="card user-detail-profile">
          <div className="card-header">
            <span className="card-title">Profile</span>
            {roleBadge}
          </div>
          <div className="user-detail-avatar-section">
            <div
              className="user-detail-avatar"
              style={{
                background:
                  user.role === 'admin'
                    ? 'var(--color-role-admin)'
                    : user.role === 'supervisor'
                      ? 'var(--color-role-supervisor)'
                      : 'var(--color-role-user)',
              }}
            >
              {user.full_name
                .split(' ')
                .map(w => w[0])
                .join('')
                .toUpperCase()
                .slice(0, 2)}
            </div>
            <div>
              <div className="text-sm font-semibold">{user.full_name}</div>
              <div className="text-xs text-muted" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Mail size={11} /> {user.email}
              </div>
            </div>
          </div>
          <div className="user-detail-field-list">
            {[
              { label: 'UID', value: user.uid },
              { label: 'Given Name', value: user.givenName },
              { label: 'Surname', value: user.sn },
              { label: 'Role', value: roleBadge },
            ].map(item => (
              <div key={item.label} className="user-detail-field">
                <span className="user-detail-field-label">{item.label}</span>
                <span className="user-detail-field-value">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Manager Card */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <UserCheck size={16} style={{ marginRight: 6 }} /> Manager
            </span>
          </div>
          {user.manager_id || user.manager ? (
            <div className="user-detail-manager">
              <div className="user-card-manager-avatar" style={{ width: 44, height: 44, fontSize: '1rem' }}>
                {(user.manager_id || user.manager || "?")[0]?.toUpperCase()}
              </div>
              <div>
                <div className="text-sm font-semibold">{user.manager_id || user.manager}</div>
                <div className="text-xs text-muted">Direct Manager</div>
              </div>
            </div>
          ) : (
            <div className="user-detail-empty">
              <UserCheck size={20} />
              <span>No manager assigned</span>
            </div>
          )}
        </div>

        {/* Groups Card */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">
              <Users size={16} style={{ marginRight: 6 }} /> Groups
            </span>
            <span className="badge badge-active" style={{ fontSize: '0.65rem' }}>
              {groups.length}
            </span>
          </div>
          {groups.length > 0 ? (
            <div className="user-detail-group-list">
              {groups.map(g => (
                <div key={g} className="user-card-group-chip" style={{ padding: '8px 14px', fontSize: '0.8rem' }}>
                  <Layers size={13} /> {g}
                </div>
              ))}
            </div>
          ) : (
            <div className="user-detail-empty">
              <Users size={20} />
              <span>No group memberships</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Identity Entitlements (LDAP) ─────────────────────────────── */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="card-title">
            <Shield size={16} style={{ marginRight: 6 }} />
            Access & Entitlements ({identityEntitlements.length})
          </span>
          <button
            className="btn btn-primary btn-sm"
            style={{
              backgroundColor: '#4f46e6',
              color: 'white',
              border: 'none',
              boxShadow: '0 2px 4px rgba(79, 70, 230, 0.2)'
            }}
            onClick={() => setAddAccessOpen(true)}
          >
            + Add Access
          </button>
        </div>
        <DataTable
          columns={accessColumns}
          data={identityEntitlements}
          loading={userQuery.isLoading}
          emptyTitle="No active access"
          emptyDesc="This user has no entitlements assigned"
        />
      </div>

      {/* ── Add Access Modal ─────────────────────────────────────────── */}
      {addAccessOpen && (
        <AddAccessModal
          uid={id!}
          onClose={() => setAddAccessOpen(false)}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ['user', id] });
            setAddAccessOpen(false);
          }}
        />
      )}

      {/* ── Deactivate dialog ──────────────────────────────────────────── */}
      <ConfirmDialog
        open={deactivateOpen}
        title="Deactivate User"
        message={`Are you sure you want to deactivate ${user.full_name}? They will lose all platform access.`}
        confirmLabel="Deactivate"
        danger
        loading={deactivate.isPending}
        onConfirm={() => deactivate.mutate()}
        onCancel={() => setDeactivateOpen(false)}
      />

      {/* ── Edit Role dialog ──────────────────────────────────────────── */}
      {roleOpen && (
        <div className="modal-overlay" onClick={() => setRoleOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
            <div className="modal-header">
              <h2 className="modal-title">Edit User Role</h2>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label className="form-label">Select Role</label>
              <select
                className="form-control"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
              >
                <option value="end_user">End User</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setRoleOpen(false)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={() => updateRole.mutate(selectedRole)}
                disabled={updateRole.isPending || selectedRole === user.role}
              >
                {updateRole.isPending ? <span className="spinner" /> : null}
                Save Role
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Add Access Modal Component ─────────────────────────────────────── */
function AddAccessModal({ uid, onClose, onSuccess }: {
  uid: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [selectedApp, setSelectedApp] = useState('');

  const { data: appsData, isLoading: appsLoading } = useQuery({
    queryKey: ['applications'],
    queryFn: () => applicationsApi.list(),
  });

  const grantMutation = useMutation({
    mutationFn: () => usersApi.addToGroup(uid, selectedApp),
    onSuccess: () => {
      toast.success(`Access granted for ${selectedApp}`);
      onSuccess();
    },
    onError: () => toast.error('Failed to grant access'),
  });

  const apps = appsData?.data ?? [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Grant Application Access</h2>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
          <p className="text-sm text-muted">Select an application to add to <strong>{uid}</strong>.</p>

          <div className="form-group">
            <label className="form-label">Application</label>
            <select
              className="form-control"
              value={selectedApp}
              onChange={e => setSelectedApp(e.target.value)}
              disabled={appsLoading}
              style={{ color: '#1a1a2e !important', backgroundColor: '#ffffff !important' }}
            >
              <option value="" style={{ color: '#333 !important' }}>Select an application...</option>
              {apps.map(app => (
                <option key={app.id} value={app.id} style={{ color: '#333 !important' }}>
                  {app.app_name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={!selectedApp || grantMutation.isPending}
            onClick={() => grantMutation.mutate()}
          >
            {grantMutation.isPending && <span className="spinner" style={{ marginRight: 8 }} />}
            Grant Access
          </button>
        </div>
      </div>
    </div>
  );
}
