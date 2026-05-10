import { useQuery } from '@tanstack/react-query';
import { Sparkles, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { aiApi } from '../../api/ai.api';
import { formatRelative } from '../../lib/utils';
import { StatusBadge } from '../../components/shared/StatusBadge';

export function AIInsightsWidget() {
  const { data: insights, isLoading } = useQuery({
    queryKey: ['ai', 'insights'],
    queryFn: () => aiApi.getInsights(),
    refetchInterval: 300000,
  });

  if (isLoading) return <div className="skeleton" style={{ height: 200 }} />;

  const insightsList = Array.isArray(insights) ? insights : [];

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles size={16} color="var(--color-primary)" /> AI Risk Insights
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {insightsList.slice(0, 3).map(insight => (
          <div key={insight.id} style={{ padding: 12, background: 'var(--color-gray-50)', borderRadius: 8, border: '1px solid var(--color-gray-100)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <span className={`badge badge-${insight.severity.toLowerCase()}`}>{insight.severity}</span>
              <span className="text-xs text-muted">{formatRelative(insight.timestamp)}</span>
            </div>
            <div className="font-medium text-sm" style={{ marginBottom: 4 }}>{insight.description}</div>
            <div className="text-xs" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>Recommendation: {insight.recommendation}</div>
          </div>
        ))}
        {insightsList.length === 0 && (
          <div className="text-center py-4 text-sm text-muted">No insights available</div>
        )}
      </div>
    </div>
  );
}

export function AIAnomaliesWidget() {
  const { data: anomalies, isLoading } = useQuery({
    queryKey: ['ai', 'anomalies'],
    queryFn: () => aiApi.getAnomalies(),
    refetchInterval: 60000,
  });

  if (isLoading) return <div className="skeleton" style={{ height: 200 }} />;

  const anomaliesList = Array.isArray(anomalies) ? anomalies : [];
  const criticalCount = anomaliesList.filter(a => a.severity === 'CRITICAL' || a.severity === 'HIGH').length;

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={16} color="var(--color-danger)" /> AI Anomalies
        </span>
        {criticalCount > 0 && <span className="badge badge-danger">{criticalCount} Critical</span>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {anomaliesList.slice(0, 3).map(anomaly => (
          <div key={anomaly.id} style={{ display: 'flex', gap: 12, padding: 10, borderBottom: '1px solid var(--color-gray-100)' }}>
            <div style={{ width: 8, height: 8, borderRadius: 999, background: anomaly.severity === 'CRITICAL' ? 'var(--color-danger)' : 'var(--color-warning)', marginTop: 6, flexShrink: 0 }} />
            <div>
              <div className="font-medium text-sm">{anomaly.description}</div>
              <div className="text-xs text-muted" style={{ marginTop: 2 }}>
                {(anomaly.affected_entities || []).join(', ')} · {formatRelative(anomaly.timestamp)}
              </div>
            </div>
          </div>
        ))}
        {anomaliesList.length === 0 && (
          <div className="text-center py-4 text-sm text-muted">No anomalies detected</div>
        )}
      </div>
    </div>
  );
}

export function AIHealthStatus() {
  const { data: health, isLoading } = useQuery({
    queryKey: ['ai', 'health'],
    queryFn: () => aiApi.getHealth(),
    refetchInterval: 30000,
  });

  if (isLoading) return <div className="skeleton" style={{ height: 40, width: 120 }} />;

  const isAllHealthy = health?.api_connected && health?.db_connected && health?.llm_connected;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: 'var(--color-gray-50)', borderRadius: 8, border: '1px solid var(--color-gray-200)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 8, height: 8, borderRadius: 999, background: isAllHealthy ? 'var(--color-success)' : 'var(--color-danger)' }} />
        <span className="text-xs font-bold" style={{ color: 'var(--color-gray-700)' }}>AI SERVICE</span>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <HealthItem label="API" ok={health?.api_connected} />
        <HealthItem label="DB" ok={health?.db_connected} />
        <HealthItem label="LLM" ok={health?.llm_connected} />
      </div>
    </div>
  );
}

function HealthItem({ label, ok }: { label: string, ok?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.65rem', fontWeight: 600, color: ok ? 'var(--color-success)' : 'var(--color-danger)' }}>
      {ok ? <CheckCircle size={10} /> : <XCircle size={10} />}
      {label}
    </div>
  );
}
