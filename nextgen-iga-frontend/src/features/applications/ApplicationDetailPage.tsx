import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { requestsApi } from '../../api/requests.api';
import { formatDate } from '../../lib/utils';

export function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError } = useQuery({ queryKey: ['application', id], queryFn: () => requestsApi.getApplication(id!), enabled: !!id });
  const app = data?.data;

  if (isLoading) return <div className="card"><div className="skeleton" style={{ height: 200 }} /></div>;
  if (isError || !app) return (
    <div className="error-state"><AlertTriangle size={32} className="error-state-icon" /><div className="error-state-title">Application not found</div><Link to="/admin/applications" className="btn btn-secondary">← Back</Link></div>
  );

  return (
    <div>
      <PageHeader
        title={app.name}
        breadcrumbs={[{ label: 'Applications', to: '/admin/applications' }, { label: app.name }]}
        subtitle={app.description}
      />
      <div className="grid-2" style={{ gap: 20 }}>
        <div className="card">
          <div className="card-header"><span className="card-title">Details</span></div>
          {[
            { label: 'Category', value: app.category },
            { label: 'Owner', value: app.owner_name },
            { label: 'Connector Status', value: <StatusBadge status={app.connector_status} /> },
            { label: 'Active Users', value: app.access_count },
            { label: 'Registered', value: formatDate(app.created_at) },
          ].map(item => (
            <div key={item.label} style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 8, padding: '10px 0', borderBottom: '1px solid var(--color-gray-100)' }}>
              <span className="text-xs text-muted font-semibold" style={{ textTransform: 'uppercase', letterSpacing: '0.4px', paddingTop: 2 }}>{item.label}</span>
              <span className="text-sm">{item.value}</span>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">Connector Status</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '20px 0' }}>
            <span className={`service-dot ${app.connector_status === 'CONNECTED' ? 'ok' : 'error'}`} style={{ width: 14, height: 14 }} />
            <div>
              <div className="font-semibold">{app.connector_status}</div>
              <div className="text-xs text-muted">Provisioning connector</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
