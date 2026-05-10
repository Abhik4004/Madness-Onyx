import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { DataTable, type Column } from '../../components/shared/DataTable';
import { rolesApi } from '../../api/users.api';
import type { Permission } from '../../types/audit.types';

export function PermissionCatalogPage() {
  const [search, setSearch] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({ 
    queryKey: ['permissions'], 
    queryFn: () => rolesApi.listPermissions() 
  });

  const permissions = (data?.data ?? []) as Permission[];

  const filtered = useMemo(() => {
    if (!search) return permissions;
    const q = search.toLowerCase();
    return permissions.filter(p => 
      p.name?.toLowerCase().includes(q) || 
      p.resource?.toLowerCase().includes(q) || 
      p.description?.toLowerCase().includes(q)
    );
  }, [permissions, search]);

  const columns: Column<Permission>[] = [
    { key: 'name', header: 'Permission', render: p => <span className="font-medium">{p.name}</span> },
    { key: 'resource', header: 'Resource', render: p => p.resource },
    { key: 'action', header: 'Action', render: p => (
      <span style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)', padding: '2px 8px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 600 }}>{p.action}</span>
    )},
    { key: 'desc', header: 'Description', render: p => p.description },
  ];

  return (
    <div>
      <PageHeader title="Permission Catalog" subtitle="All available permissions in the system" />
      
      <div className="filters-bar">
        <div className="search-input-wrap">
          <Search size={14} />
          <input 
            className="form-control" 
            placeholder="Search permissions…" 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
          />
        </div>
      </div>

      {isError ? (
        <div className="error-state"><div className="error-state-title">Failed to load permissions</div><button className="btn btn-secondary" onClick={() => refetch()}>Retry</button></div>
      ) : (
        <DataTable columns={columns} data={filtered} loading={isLoading} emptyTitle="No permissions found" />
      )}
    </div>
  );
}
