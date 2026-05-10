import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { auditApi } from '../../api/audit.api';
import { formatDateTime } from '../../lib/utils';

export function AuditLogDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { data, isLoading, isError } = useQuery({ queryKey: ['auditLog', eventId], queryFn: () => auditApi.get(eventId!), enabled: !!eventId });
  const log = data?.data;

  if (isLoading) return <div className="card"><div className="skeleton" style={{ height: 300 }} /></div>;
  if (isError || !log) return (
    <div className="error-state"><AlertTriangle size={32} className="error-state-icon" /><div className="error-state-title">Log not found</div><Link to="/admin/audit" className="btn btn-secondary">← Back</Link></div>
  );

  return (
    <div>
      <PageHeader
        title={log.event_type.replace(/_/g, ' ')}
        breadcrumbs={[{ label: 'Audit Logs', to: '/admin/audit' }, { label: 'Detail' }]}
        subtitle={formatDateTime(log.created_at)}
      />
      <div className="grid-2" style={{ gap: 20 }}>
        <div className="card">
          <div className="card-header"><span className="card-title">Event Details</span></div>
          {[
            { label: 'Event Type', value: log.event_type },
            { label: 'Actor', value: log.actor_name },
            { label: 'Target', value: log.target_type && log.target_id ? `${log.target_type} (${log.target_id})` : '—' },
            { label: 'Description', value: log.description },
            { label: 'IP Address', value: log.ip_address },
            { label: 'Timestamp', value: formatDateTime(log.created_at) },
          ].map(item => (
            <div key={item.label} style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: 8, padding: '10px 0', borderBottom: '1px solid var(--color-gray-100)' }}>
              <span className="text-xs text-muted font-semibold" style={{ textTransform: 'uppercase', letterSpacing: '0.4px', paddingTop: 2 }}>{item.label}</span>
              <span className="text-sm">{item.value}</span>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">Payload</span></div>
          <div className="json-block">{JSON.stringify(log.payload, null, 2)}</div>
        </div>
      </div>
    </div>
  );
}
