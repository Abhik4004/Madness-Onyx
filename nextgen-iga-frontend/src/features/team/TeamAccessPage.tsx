import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search, List, GitBranch, User as UserIcon, ChevronRight } from 'lucide-react';
import { useState, useMemo } from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { DataTable, type Column } from '../../components/shared/DataTable';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { usersApi } from '../../api/users.api';
import { usePagination } from '../../hooks/usePagination';
import { useAuthStore } from '../../stores/auth.store';
import type { User } from '../../api/users.api';

/* ── Recursive Tree Node ────────────────────────────────────────────── */
function HierarchyNode({ node }: { node: any }) {
  const hasChildren = node.reports && node.reports.length > 0;
  const role = (node.role_id || node.role || '').toLowerCase();

  return (
    <div className="hierarchy-node">
      {/* Card */}
      <Link to={`/supervisor/team/${node.uid}`} className="hierarchy-card-link" style={{ textDecoration: 'none', color: 'inherit' }}>
        <div className={`hierarchy-card role-${role}`}>
          <div className="hierarchy-avatar">
            {node.full_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
          </div>
          <div className="hierarchy-info">
            <div className="hierarchy-name">{node.full_name}</div>
            <div className="hierarchy-role">{role.replace(/_/g, ' ')}</div>
            {node.status === 'PENDING_APPROVAL' && (
              <div className="text-xs font-semibold" style={{ color: 'var(--color-warning)', marginTop: 2 }}>
                Pending
              </div>
            )}
          </div>
        </div>
      </Link>

      {/* Children */}
      {hasChildren && (
        <>
          <div className="hierarchy-connector-down" />
          <div className="hierarchy-children">
            {node.reports.map((child: any) => (
              <div key={child.id} className="hierarchy-child-wrap">
                <div className="hierarchy-child-stub" />
                <HierarchyNode node={child} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function TeamAccessPage() {
  const { user: currentUser } = useAuthStore();
  const { page, perPage, setPage } = usePagination();
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'hierarchy'>('list');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['team', { page, search }],
    queryFn: () => usersApi.list({ page, per_page: viewMode === 'hierarchy' ? 1000 : perPage, search }),
  });

  // ── Client-side filtering ──
  const filteredUsers = useMemo(() => {
    const allUsers = (data?.data ?? []) as User[];
    if (!currentUser) return [];

    const currentUserId = String(currentUser.id).toLowerCase();

    const userMap = new Map<string, User>();
    allUsers.forEach(u => userMap.set(String(u.uid).toLowerCase(), u));

    const isUnderCurrentUser = (uid: string): boolean => {
      let current = userMap.get(uid);
      const visited = new Set<string>();
      
      while (current && !visited.has(String(current.uid).toLowerCase())) {
        visited.add(String(current.uid).toLowerCase());
        const m = String(current.manager_id || current.manager || '').toLowerCase();
        let mId = m;
        if (m.includes('uid=')) {
          const match = m.match(/uid=([^,]+)/);
          if (match) mId = match[1];
        }
        if (mId === currentUserId) return true;
        current = userMap.get(mId);
      }
      return false;
    };

    return allUsers.filter(u => isUnderCurrentUser(String(u.uid).toLowerCase()));
  }, [data?.data, currentUser]);

  // ── Local Hierarchy Building ──
  const hierarchyData = useMemo(() => {
    if (viewMode !== 'hierarchy' || !filteredUsers || !currentUser) return [];

    const allUsers = filteredUsers;
    const userMap: Record<string, any> = {};
    allUsers.forEach(u => { userMap[u.uid] = { ...u, reports: [] }; });

    const roots: any[] = [];
    const childIds = new Set<string>();

    allUsers.forEach(u => {
      const node = userMap[u.uid];
      
      // Parse manager safely for hierarchy
      const m = String(u.manager_id || u.manager || '').toLowerCase();
      let mId = m;
      if (m.includes('uid=')) {
        const match = m.match(/uid=([^,]+)/);
        if (match) mId = match[1];
      }

      if (mId && userMap[mId]) {
        userMap[mId].reports.push(node);
        childIds.add(u.uid);
      }
    });

    if (userMap[currentUser.id]) roots.push(userMap[currentUser.id]);
    else allUsers.forEach(u => { 
      const m = String(u.manager_id || u.manager || '').toLowerCase();
      let mId = m;
      if (m.includes('uid=')) {
        const match = m.match(/uid=([^,]+)/);
        if (match) mId = match[1];
      }
      if (mId === String(currentUser.id).toLowerCase()) roots.push(userMap[u.uid]); 
    });

    if (roots.length === 0) {
      allUsers.forEach(u => { if (!childIds.has(u.uid)) roots.push(userMap[u.uid]); });
    }
    return roots;
  }, [filteredUsers, currentUser, viewMode]);

  const columns: Column<User>[] = [
    {
      key: 'name', header: 'Name', render: u => (
        <div className="flex items-center gap-3">
          <div className="avatar-sm" style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)', fontWeight: 600 }}>
            {u.full_name[0]}
          </div>
          <span className="font-medium">{u.full_name}</span>
        </div>
      )
    },
    { key: 'email', header: 'Email', render: u => u.email },
    { key: 'role', header: 'Role', render: u => <StatusBadge status={u.role.replace('_', ' ').toUpperCase()} /> },
    { key: 'status', header: 'Status', render: u => <StatusBadge status={u.status} /> },
    {
      key: 'actions', header: '', render: u => (
        <Link to={`/supervisor/team/${u.uid}`} className="btn btn-sm btn-secondary text-xs" style={{ whiteSpace: 'nowrap' }}>
          View Details →
        </Link>
      )
    }
  ];

  return (
    <div className="fade-in">
      <div className="flex items-center justify-between mb-6">
        <PageHeader title="My Team" subtitle="View and manage your direct reports' access" />

        <div className="view-toggle">
          <button
            className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
          >
            <List size={14} /> Users
          </button>
          <button
            className={`view-toggle-btn ${viewMode === 'hierarchy' ? 'active' : ''}`}
            onClick={() => setViewMode('hierarchy')}
          >
            <GitBranch size={14} /> Hierarchy
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div className="search-input-wrap">
          <Search size={15} />
          <input
            className="form-control"
            placeholder="Search by name, email, or ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: 320 }}
          />
        </div>
      </div>

      {isError ? (
        <div className="error-state card">
          <div className="error-state-title">Failed to load team</div>
          <p className="text-muted mb-4">There was an issue connecting to the identity service.</p>
          <button className="btn btn-primary" onClick={() => refetch()}>Retry Connection</button>
        </div>
      ) : viewMode === 'list' ? (
        <DataTable
          columns={columns}
          data={filteredUsers}
          loading={isLoading}
          totalPages={Math.ceil(filteredUsers.length / perPage) || 1}
          currentPage={page}
          total={filteredUsers.length}
          perPage={perPage}
          onPageChange={setPage}
          emptyTitle="No team members found"
        />
      ) : (
        <div className="card hierarchy-card-container" style={{ overflowX: 'auto', padding: '40px 20px', minHeight: 400 }}>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="spinner-lg" />
              <div className="text-muted">Building organizational tree...</div>
            </div>
          ) : hierarchyData.length > 0 ? (
            <div className="hierarchy-container">
              <div className="hierarchy-tree">
                {Array.isArray(hierarchyData) && hierarchyData.map(root => (
                  <HierarchyNode key={root.id} node={root} />
                ))}
              </div>
            </div>
          ) : (
            <div className="empty-state py-20">
              <GitBranch size={48} className="text-muted mb-4" />
              <div className="empty-state-title">No hierarchy available</div>
              <div className="empty-state-desc">We couldn't determine the reporting structure for your team.</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
