import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { DataTable, type Column } from '../../components/shared/DataTable';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { requestsApi } from '../../api/requests.api';
import type { Application } from '../../types/request.types';

export function ApplicationListPage() {
  const [search, setSearch] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['applications'],
    queryFn: () => requestsApi.listApplications({}),
  });

  const apps = (data?.data ?? []) as Application[];

  const filtered = useMemo(() => {
    if (!search) return apps;
    const q = search.toLowerCase();
    return apps.filter(a =>
      a.name?.toLowerCase().includes(q) ||
      a.owner_name?.toLowerCase().includes(q)
    );
  }, [apps, search]);

  const columns: Column<Application>[] = [
    { key: 'name', header: 'Application', render: a => <Link to={`/admin/applications/${a.id}`} className="font-medium" style={{ color: 'var(--color-primary)' }}>{a.name || a.id}</Link> },
    { key: 'owner', header: 'Owner', render: a => a.owner_name },
    { key: 'access', header: 'Active Users', render: a => a.access_count },
    { key: 'connector', header: 'Connector', render: a => <StatusBadge status={a.connector_status} /> },
  ];

  return (
    <div>
      <PageHeader title="Applications" subtitle="Manage registered applications and connectors" actions={<Link to="/admin/applications/new" className="btn btn-primary"><Plus size={16} /> Register App</Link>} />
      <div className="filters-bar">
        <div className="search-input-wrap">
          <Search size={14} />
          <input className="form-control" placeholder="Search applications…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>
      {isError ? (
        <div className="error-state"><div className="error-state-title">Failed to load applications</div><button className="btn btn-secondary" onClick={() => refetch()}>Retry</button></div>
      ) : (
        <DataTable columns={columns} data={filtered} loading={isLoading} emptyTitle="No applications registered" emptyAction={<Link to="/admin/applications/new" className="btn btn-primary"><Plus size={14} /> Register App</Link>} />
      )}
    </div>
  );
}
