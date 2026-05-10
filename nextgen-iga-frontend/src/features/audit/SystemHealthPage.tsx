import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { healthApi } from '../../api/health.api';
import { formatRelative } from '../../lib/utils';

export function SystemHealthPage() {
  const { data, isLoading, dataUpdatedAt, refetch, isFetching } = useQuery({
    queryKey: ['health'],
    queryFn: () => healthApi.check(),
    refetchInterval: 60_000,
  });

  const services = Object.entries(data?.services ?? {});
  const allOk = services.length > 0 && services.every(([, v]) => v === 'ok' || v === 'healthy');

  return (
    <div>
      <PageHeader
        title="System Health"
        subtitle="Real-time service status"
        actions={
          <button className="btn btn-secondary btn-sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw size={14} className={isFetching ? 'spinner' : ''} /> Refresh
          </button>
        }
      />

      {dataUpdatedAt > 0 && (
        <div className="text-xs text-muted" style={{ marginBottom: 16 }}>
          Last updated {formatRelative(new Date(dataUpdatedAt).toISOString())}
        </div>
      )}

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className={`service-dot ${isLoading ? 'unknown' : allOk ? 'ok' : 'error'}`} style={{ width: 14, height: 14 }} />
          <div>
            <div className="font-semibold">{isLoading ? 'Checking…' : allOk ? 'All systems operational' : 'Degraded — some services have issues'}</div>
            <div className="text-xs text-muted">Overall platform status</div>
          </div>
        </div>
      </div>

      <div className="service-status-grid">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 72, borderRadius: 'var(--radius-md)' }} />
          ))
        ) : services.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-title">No service data available</div>
            <div className="empty-state-desc">The health endpoint did not return service details</div>
          </div>
        ) : (
          services.map(([name, status]) => (
            <div key={name} className="service-card">
              <span className={`service-dot ${status === 'ok' || status === 'healthy' ? 'ok' : 'error'}`} />
              <div>
                <div className="service-name">{name}</div>
                <div className="service-state">{status}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
