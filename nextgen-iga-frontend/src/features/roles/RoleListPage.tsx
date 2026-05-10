import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { DataTable, type Column } from '../../components/shared/DataTable';
import { rolesApi } from '../../api/users.api';
import type { Role } from '../../types/audit.types';

export function RoleListPage() {
  const [search, setSearch] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['roles'],
    queryFn: () => rolesApi.list(),
  });

  const staticRoles = [
    { id: 'role-viewer', name: 'Viewer', description: 'Read-only access to all reports and dashboards. Cannot perform any administrative actions.', permissions: ['READ_ALL'], user_count: 12 },
    { id: 'role-editor', name: 'Editor', description: 'Can create requests, manage team access, and run recommendations within assigned departments.', permissions: ['READ_ALL', 'CREATE_REQUEST', 'MANAGE_TEAM'], user_count: 24 },
    { id: 'role-admin', name: 'Admin', description: 'Full platform control, including system configuration, user management, and global audit oversight.', permissions: ['*'], user_count: 5 },
  ];

  const roles = (data?.data && data.data.length > 0 ? data.data : staticRoles) as Role[];

  const filtered = useMemo(() => {
    if (!search) return roles;
    const q = search.toLowerCase();
    return roles.filter(r => 
      r.name?.toLowerCase().includes(q) || 
      r.description?.toLowerCase().includes(q)
    );
  }, [roles, search]);

  const columns: Column<Role>[] = [
    { key: 'name', header: 'Role Name', render: r => <Link to={`/admin/roles/${r.id}`} className="font-medium" style={{ color: 'var(--color-primary)' }}>{r.name}</Link> },
    { key: 'desc', header: 'Description', render: r => r.description },
    { key: 'perms', header: 'Permissions', render: r => r.permissions?.length ?? 0 },
    { key: 'users', header: 'Users', render: r => r.user_count ?? 0 },
    { key: 'actions', header: '', render: r => <Link to={`/admin/roles/${r.id}`} className="btn btn-sm btn-secondary">View</Link>, width: '70px' },
  ];

  return (
    <div>
      <PageHeader
        title="Roles"
        subtitle="Manage roles and their permission sets"
        actions={<Link to="/admin/roles/new" className="btn btn-primary"><Plus size={16} /> New Role</Link>}
      />

      <div className="filters-bar">
        <div className="search-input-wrap">
          <Search size={14} />
          <input 
            className="form-control" 
            placeholder="Search roles…" 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
          />
        </div>
      </div>

      {isError ? (
        <div className="error-state"><div className="error-state-title">Failed to load roles</div><button className="btn btn-secondary" onClick={() => refetch()}>Retry</button></div>
      ) : (
        <DataTable columns={columns} data={filtered} loading={isLoading} emptyTitle="No roles defined" emptyAction={<Link to="/admin/roles/new" className="btn btn-primary"><Plus size={14} /> New Role</Link>} />
      )}
    </div>
  );
}
