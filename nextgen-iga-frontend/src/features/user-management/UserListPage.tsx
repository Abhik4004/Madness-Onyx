import { useState} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search, ChevronDown, ChevronUp, Users, Shield, UserCheck, Layers, Mail, Crown } from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeader } from '../../components/layout/PageHeader';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { usersApi, type User } from '../../api/users.api';
import { formatDate } from '../../lib/utils';
import type { UserAccess } from '../../types/provision.types';

/* ── Inline access mini-table (loaded lazily) ───────────────────────── */
function UserAccessTable({ uid }: { uid: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['userAccess', uid],
    queryFn: () => usersApi.getUserAccess(uid),
    retry: false, // Don't storm the server if NATS is down
    staleTime: 300000, // 5 min cache
  });

  if (isLoading) return <div className="skeleton" style={{ height: 48, borderRadius: 6 }} />;
  if (isError) return <div className="text-xs text-muted">Failed to load access</div>;

  const items: UserAccess[] = data?.data ?? [];
  if (items.length === 0) return <div className="text-xs text-muted" style={{ padding: '8px 0' }}>No active entitlements</div>;

  return (
    <div className="table-wrapper" style={{ fontSize: '0.8rem' }}>
      <table>
        <thead>
          <tr>
            <th>Application</th>
            <th>Entitlement</th>
            <th>Status</th>
            <th>Granted</th>
            <th>Expires</th>
          </tr>
        </thead>
        <tbody>
          {items.map(a => (
            <tr key={a.id}>
              <td>Open DS</td>
              <td>{a.application_name}</td>
              <td><StatusBadge status={a.status} /></td>
              <td>{formatDate(a.granted_at)}</td>
              <td>{a.expires_at ? formatDate(a.expires_at) : 'Never'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Initials avatar ────────────────────────────────────────────────── */
function Avatar({ name, role }: { name: string; role: string }) {
  const initials = name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const colorMap: Record<string, string> = {
    admin: 'var(--color-role-admin)',
    supervisor: 'var(--color-role-supervisor)',
    end_user: 'var(--color-role-user)',
  };

  return (
    <div
      className="user-card-avatar"
      style={{ background: colorMap[role] ?? 'var(--color-primary)' }}
    >
      {initials}
    </div>
  );
}

/* ── Role badge ─────────────────────────────────────────────────────── */
function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`badge badge-role-${role}`}>
      {role === 'admin' && <Crown size={10} />}
      {role === 'supervisor' && <Shield size={10} />}
      {role === 'end_user' && <UserCheck size={10} />}
      {role.replace(/_/g, ' ')}
    </span>
  );
}

/* ── Single user card ───────────────────────────────────────────────── */
function UserCard({ user, managers }: {
  user: User,
  managers: User[]
}) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [approvedLocal, setApprovedLocal] = useState<boolean | null>(null);
  // Source of truth is the 'status' field: if it's PENDING_APPROVAL, it's not yet approved.
  const isApproved = approvedLocal ?? (user.status === 'ACTIVE');

  return (
    <div className={`user-card ${expanded ? 'user-card--expanded' : ''}`} id={`user-card-${user.uid}`}>
      {/* ─ Header row (always visible) ─ */}
      <div className="user-card-header" onClick={() => setExpanded(!expanded)}>
        <Avatar name={user.full_name} role={user.role} />

        <div className="user-card-info">
          <div className="user-card-name">{user.full_name}</div>
          <div className="user-card-email">
            <Mail size={12} /> {user.email}
          </div>
          {user.manager && (
            <div className="user-card-manager-tag">
              <UserCheck size={10} /> Manager: {user.manager}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'end' }}>
          <RoleBadge role={user.role} />
          <StatusBadge status={isApproved ? 'ACTIVE' : (user.status || 'PENDING_APPROVAL')} />
        </div>

        <div className="user-card-meta">
          <div className="user-card-meta-item">
            <UserCheck size={12} />
            <span>{user.manager_id || user.manager || 'Not Assigned'}</span>
          </div>
          <div className="user-card-meta-item">
            <Users size={12} />
            <span>{user.groups.length > 0 ? user.groups.join(', ') : 'No Groups'}</span>
          </div>
        </div>

        <div className="user-card-actions">
          {/* Manager Assignment */}
          <div className="role-selector-wrap" onClick={e => e.stopPropagation()}>
            <select
              className="btn btn-sm btn-ghost text-xs"
              style={{ border: '1px solid var(--border-color)', height: 28, width: 140 }}
              value={user.manager || ''}
              title="Assign Manager"
              onChange={async (e) => {
                const managerUid = e.target.value;
                if (!managerUid) return;

                const targetUid = user.uid || user.id;
                if (!targetUid) {
                  toast.error('Cannot assign manager: User ID missing');
                  return;
                }

                try {
                  // Construct the full LDAP DN for the manager
                  const managerDn = `uid=${managerUid},ou=users,dc=example,dc=com`;
                  await usersApi.updateAttributes(targetUid, { manager: managerDn });

                  toast.success(`Manager assignment for ${targetUid} requested`);
                  // Invalidate user list to trigger refetch
                  qc.invalidateQueries({ queryKey: ['admin', 'users'] });
                } catch (err) {
                  toast.error('Failed to assign manager');
                }
              }}
            >
              <option value="">Assign Manager...</option>
              {managers
                .filter(m => m.uid && m.uid !== user.uid)
                .map(m => (
                  <option key={m.uid} value={m.uid}>
                    {m.full_name || m.uid} ({m.role === 'admin' ? 'Admin' : 'Supervisor'})
                  </option>
                ))}
            </select>
          </div>

          <div className="role-selector-wrap" onClick={e => e.stopPropagation()}>
            <select
              className="btn btn-sm btn-ghost text-xs"
              style={{ border: '1px solid var(--border-color)', height: 28 }}
              value={user.role}
              title="Change Role"
              onChange={async (e) => {
                const newRole = e.target.value;
                if (window.confirm(`Promote ${user.full_name} to ${newRole}?`)) {
                  try {
                    await usersApi.addToGroup(user.uid, newRole);
                    toast.success(`Role change for ${user.uid} requested`);
                    // Invalidate user list to trigger refetch
                    qc.invalidateQueries({ queryKey: ['admin', 'users'] });
                  } catch (err) {
                    toast.error('Failed to update role');
                  }
                }
              }}
            >
              <option value="end_user">End User</option>
              <option value="supervisor">Supervisor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {!isApproved && (
            <button
              className="btn btn-sm"
              style={{ fontWeight: 800, background: 'var(--color-success)', color: 'white' }}
              onClick={async (e) => {
                e.stopPropagation();
                try {
                  const uid = user.uid || user.id;
                  setApprovedLocal(true); // optimistic
                  await usersApi.approveUser(uid);
                  toast.success(`${user.full_name} approved and onboarded successfully`);
                  qc.invalidateQueries({ queryKey: ['admin', 'users'] });
                } catch {
                  setApprovedLocal(null); // rollback
                  toast.error('Failed to approve user');
                }
              }}
            >
              <UserCheck size={14} /> Approve & Onboard
            </button>
          )}



          <button className="btn btn-sm btn-ghost" aria-label="Toggle details">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* ─ Expanded details (manager, groups, access) ─ */}
      {expanded && (
        <div className="user-card-body">
          <div className="user-card-sections">
            {/* Manager */}
            <div className="user-card-section">
              <div className="user-card-section-title">
                <UserCheck size={14} /> Manager
              </div>
              <div className="user-card-section-content">
                {user.manager_id || user.manager ? (
                  <div className="user-card-manager-chip">
                    <div className="user-card-manager-avatar">
                      {(user.manager_id || user.manager || "?")[0]?.toUpperCase()}
                    </div>
                    <span>{user.manager_id || user.manager}</span>
                  </div>
                ) : (
                  <span className="text-muted text-xs">Not Assigned</span>
                )}
              </div>
            </div>

            {/* Groups */}
            <div className="user-card-section">
              <div className="user-card-section-title">
                <Users size={14} /> Groups
              </div>
              <div className="user-card-section-content">
                {user.groups.length > 0 ? (
                  <div className="user-card-group-list">
                    {user.groups.map(g => (
                      <span key={g} className="user-card-group-chip">
                        <Layers size={10} /> {g}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-muted text-xs">No group memberships</span>
                )}
              </div>
            </div>

            {/* Access / Entitlements */}
            <div className="user-card-section user-card-section--full">
              <div className="user-card-section-title">
                <Shield size={14} /> Access & Entitlements
              </div>
              <div className="user-card-section-content">
                <UserAccessTable uid={user.uid} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Main page ──────────────────────────────────────────────────────── */
export function UserListPage() {
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');

  // Fetch Users
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'users', { search, role }],
    queryFn: () => usersApi.list({ search, role }),
  });

  const users: User[] = data?.data ?? [];
  const managers = users.filter(u => u.role === 'supervisor' || u.role === 'admin');

  // Unified Search & Filter Logic
  const filtered = users; // Server-side search/filtering implemented


  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Manage platform users — view roles, managers, groups & access entitlements"
        actions={
          <div style={{ display: 'flex', gap: 12 }}>
            <button 
              className="btn btn-secondary btn-sm"
              onClick={async () => {
                const id = toast.loading('Syncing with LDAP authoritative source...');
                try {
                  await usersApi.syncLdap();
                  toast.success('Synchronization completed successfully', { id });
                  refetch();
                } catch (e) {
                  toast.error('Synchronization failed', { id });
                }
              }}
            >
              Sync with LDAP
            </button>
            <Link to="/admin/users/new" className="btn btn-primary btn-sm">
              + Create User
            </Link>
          </div>
        }
      />

      {/* Filters */}
      <div className="filters-bar">
        <div className="search-input-wrap">
          <Search size={14} aria-hidden="true" />
          <input
            id="user-search"
            className="form-control"
            placeholder="Search by name, email or UID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Search users"
          />
        </div>
        <select
          id="user-role-filter"
          className="form-control"
          style={{ width: 160 }}
          value={role}
          onChange={e => setRole(e.target.value)}
        >
          <option value="">All Roles</option>
          <option value="end_user">End User</option>
          <option value="supervisor">Supervisor</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      {/* User cards */}
      {isError ? (
        <div className="error-state">
          <div className="error-state-title">Failed to load users</div>
          <button className="btn btn-secondary" onClick={() => refetch()}>
            Retry
          </button>
        </div>
      ) : isLoading ? (
        <div className="user-card-list">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="user-card">
              <div className="user-card-header" style={{ pointerEvents: 'none' }}>
                <div className="skeleton skeleton-circle" style={{ width: 42, height: 42 }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div className="skeleton skeleton-text" style={{ width: '40%' }} />
                  <div className="skeleton skeleton-text" style={{ width: '60%' }} />
                </div>
                <div className="skeleton skeleton-text" style={{ width: 70 }} />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon"><Users size={24} /></div>
            <div className="empty-state-title">No users found</div>
            <div className="empty-state-desc">Try adjusting your search or filters</div>
          </div>
        </div>
      ) : (
        <div className="user-card-list">
          <div className="user-card-list-count text-xs text-muted">
            Showing {filtered.length} user{filtered.length !== 1 ? 's' : ''}
          </div>
          {filtered.map(u => (
            <UserCard
              key={u.uid}
              user={u}
              managers={managers}
            />
          ))}
        </div>
      )}
    </div>
  );
}
