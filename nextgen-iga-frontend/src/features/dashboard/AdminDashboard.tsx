import { useQuery } from '@tanstack/react-query';
import { Users, Database, FileText, AlertCircle, ClipboardList, Activity, Shield, History as HistoryIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/layout/PageHeader';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { dashboardApi } from '../../api/dashboard.api';
import { provisionApi } from '../../api/provision.api';
import { formatDate, formatRelative } from '../../lib/utils';
import { useAuth } from '../../hooks/useAuth';
import { recommendationsApi } from '../../api/recommendations.api';
import { Lightbulb, Sparkles } from 'lucide-react';
// import { AIInsightsWidget, AIAnomaliesWidget } from '../ai/AIWidgets';

export function AdminDashboard() {
  const { data: response, isLoading } = useQuery({
    queryKey: ['admin', 'dashboard', 'stats'],
    queryFn: () => dashboardApi.getAdminStats(),
    refetchInterval: 60_000,
  });

  const stats = response?.data;
  const services = Object.entries(stats?.system_health?.services ?? {});
  const allOk = services.every(([, v]) => v === 'ok' || v === 'healthy');

  const { data: activeAccess, isLoading: isActiveLoading } = useQuery({
    queryKey: ['admin', 'activeAccess'],
    queryFn: () => provisionApi.listActiveAccess(),
    refetchInterval: 60_000,
  });
  
  const { user } = useAuth();
  const teamRecommendations = useQuery({
    queryKey: ['recommendations', 'team', user?.id],
    queryFn: () => recommendationsApi.getTeamRecommendations(user!.id),
    enabled: !!user,
  });

  const teamRecs = (teamRecommendations.data as any)?.data || [];

  return (
    <div className="fade-in">
      <PageHeader
        title="Admin Dashboard"
        subtitle="Platform-wide operations and health"
      />

      {/* System Health Banner */}
      {!isLoading && !allOk && (
        <div className="alert alert-warning" style={{ marginBottom: 20 }}>
          <AlertCircle size={18} />
          <span>One or more services are degraded. <Link to="/admin/system">View system health →</Link></span>
        </div>
      )}

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon blue"><Users size={24} /></div>
          <div className="kpi-label">Total Platform Users</div>
          <div className="kpi-value">{isLoading ? '—' : stats?.total_users ?? 0}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon amber"><FileText size={24} /></div>
          <div className="kpi-label">Pending Approvals</div>
          <div className="kpi-value">{isLoading ? '—' : stats?.pending_requests ?? 0}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon red"><AlertCircle size={24} /></div>
          <div className="kpi-label">System Anomalies</div>
          <div className="kpi-value">{isLoading ? '—' : stats?.failed_jobs ?? 0}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon green"><ClipboardList size={24} /></div>
          <div className="kpi-label">Active Certifications</div>
          <div className="kpi-value">{isLoading ? '—' : stats?.open_certifications ?? 0}</div>
        </div>
      </div>

      {/* <div className="grid-12" style={{ marginBottom: 32 }}>
        <div className="span-6 glass" style={{ padding: 4, borderRadius: 24, background: 'rgba(37, 99, 235, 0.05)' }}><AIInsightsWidget /></div>
        <div className="span-6 glass" style={{ padding: 4, borderRadius: 24, background: 'rgba(239, 68, 68, 0.05)' }}><AIAnomaliesWidget /></div>
      </div> */}

      <div className="grid-12" style={{ marginBottom: 32 }}>
        {/* Recent Audit Events */}
        <div className="card span-6">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Activity size={20} className="text-primary" /> System Audit Stream
            </span>
            <Link to="/admin/audit" className="text-sm font-bold" style={{ color: 'var(--color-primary)' }}>Full Logs →</Link>
          </div>
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 48, borderRadius: 12 }} />)}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {(stats?.recent_audit_events ?? []).slice(0, 5).map((log) => (
                <div key={log.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid var(--color-gray-50)' }}>
                  <div>
                    <div className="font-bold text-sm" style={{ color: 'var(--color-gray-900)' }}>{log.event_type.replace(/_/g, ' ')}</div>
                    <div className="text-xs text-muted mt-1">{log.actor_name} · {formatRelative(log.created_at)}</div>
                  </div>
                  <Link to={`/admin/audit/${log.id}`} className="badge" style={{ background: 'var(--color-gray-100)', color: 'var(--color-gray-600)', fontWeight: 700 }}>Details</Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Service Health */}
        <div className="card span-6">
          <div className="card-header">
            <span className="card-title">Infrastructure Health</span>
            <Link to="/admin/system" className="text-sm font-bold" style={{ color: 'var(--color-primary)' }}>System Map →</Link>
          </div>
          {isLoading ? (
            <div className="service-status-grid">
              {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 12 }} />)}
            </div>
          ) : services.length === 0 ? (
            <p className="text-sm text-muted" style={{ padding: '40px 0', textAlign: 'center' }}>No telemetry data available</p>
          ) : (
            <div className="service-status-grid">
              {services.map(([name, status]) => (
                <div key={name} className="service-card" style={{ background: 'var(--color-gray-50)', border: '1px solid var(--color-gray-100)', borderRadius: 14 }}>
                  <span className={`service-dot ${status === 'ok' || status === 'healthy' ? 'ok' : 'error'}`} style={{ width: 10, height: 10 }} />
                  <div>
                    <div className="service-name" style={{ fontWeight: 700 }}>{name}</div>
                    <div className="service-state" style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 0.5 }}>{status}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Team Onboarding Suggestions */}
      {teamRecs.length > 0 && (
        <div className="card" style={{ marginBottom: 20, border: '1px dashed var(--color-primary)', background: 'var(--color-primary-lightest)' }}>
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-primary)' }}>
              <Lightbulb size={18} /> Team Onboarding Suggestions
            </span>
            <span className="text-xs font-medium px-2 py-1 bg-white rounded-full text-primary border border-primary-light">
              {teamRecs.length} reports need access
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {teamRecs.map((member: any) => (
              <div key={member.userId} style={{ padding: 16, background: 'white', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-gray-100)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div className="font-bold text-sm" style={{ color: 'var(--color-gray-900)' }}>{member.userName}</div>
                  <div className="text-xs text-muted">Direct Report</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                  {member.suggestions.map((s: any, idx: number) => (
                    <div key={idx} style={{ padding: 10, background: 'var(--color-gray-50)', borderRadius: 6, border: '1px solid var(--color-gray-200)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700 }}>
                        <span>{s.entitlement}</span>
                        <span style={{ color: 'var(--color-success)' }}>{s.confidence}%</span>
                      </div>
                      <div className="text-xs text-muted" style={{ marginTop: 4, fontSize: '0.65rem' }}>{s.reason}</div>
                      <Link to="/requests/new" className="text-xs font-bold block mt-2" style={{ color: 'var(--color-primary)', textAlign: 'right' }}>Provision →</Link>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Global Active Access (Down Below) */}
      <div className="card">
        <div className="card-header">
          <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={16} className="text-primary" /> Global Active Access
          </span>
          <Link to="/admin/access" className="text-sm" style={{ color: 'var(--color-primary)' }}>Manage All →</Link>
        </div>
        
        {isActiveLoading ? (
          <div className="skeleton-list">
            {[1, 2, 3].map(i => <div key={i} className="skeleton-row" style={{ height: 48, marginBottom: 10 }} />)}
          </div>
        ) : (
          <div className="table-wrapper" style={{ border: 'none' }}>
            <table className="table-sm">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Application</th>
                  <th>Status</th>
                  <th>Granted</th>
                </tr>
              </thead>
              <tbody>
                {(activeAccess?.data ?? []).slice(0, 10).map((access, idx) => (
                  <tr key={access.id || idx}>
                    <td className="font-medium">{access.user_name}</td>
                    <td>{access.application_name}</td>
                    <td><StatusBadge status={access.status} /></td>
                    <td className="text-muted text-xs">{formatDate(access.granted_at)}</td>
                  </tr>
                ))}
                {(activeAccess?.data ?? []).length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-muted">No active access records found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
