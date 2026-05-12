import { useQuery } from '@tanstack/react-query';
import { FileText, CheckCircle, Bell, Lightbulb, AlertTriangle, Sparkles, Download, Clock, ClipboardList } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/layout/PageHeader';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { requestsApi } from '../../api/requests.api';
import { notificationsApi } from '../../api/notifications.api';
import { igaRecommendationApi } from '../../api/iga-recommendation.api';
import { IGARecommendationPanel } from '../recommendations/components/IGARecommendationPanel';
import { certificationApi } from '../../api/certification.api';
import { useAuth } from '../../hooks/useAuth';
import { usePermissions } from '../../hooks/usePermissions';
import { formatDate, formatRelative, getErrorMessage } from '../../lib/utils';
import { AdminDashboard } from './AdminDashboard';
// import { AIInsightsWidget, AIAnomaliesWidget } from '../ai/AIWidgets';

export function UserDashboard() {
  const { user } = useAuth();
  const { isAdmin, isSupervisor } = usePermissions();

  const pendingReqs = useQuery({
    queryKey: ['requests', { status: 'PENDING', page: 1 }],
    queryFn: () => requestsApi.list({ status: 'PENDING', per_page: 1 }),
  });

  const recentReqs = useQuery({
    queryKey: ['requests', 'recent', { page: 1 }],
    queryFn: () => requestsApi.list({ page: 1, per_page: 5 }),
  });

  const activeReqs = useQuery({
    queryKey: ['requests', { status: 'APPROVED', page: 1 }],
    queryFn: () => requestsApi.list({ status: 'APPROVED', per_page: 1 }),
  });

  const notifications = useQuery({
    queryKey: ['notifications', { read: false }],
    queryFn: () => notificationsApi.list({ read: false, per_page: 5 }),
    refetchInterval: 30_000,
  });

  // Old personal recommendations removed as per instruction
  const recommendations = { data: { data: [] }, isLoading: false };
  
  const certifications = useQuery({
    queryKey: ['certifications', { status: 'ACTIVE' }],
    queryFn: () => certificationApi.list({ status: 'ACTIVE' }),
    enabled: isSupervisor,
  });

  const managerReview = useQuery({
    queryKey: ['iga-recommendations', 'manager-review', user?.id],
    queryFn: () => igaRecommendationApi.getManagerReview(user!.id),
    enabled: isSupervisor && !!user,
  });

  const teamRecs = managerReview.data?.results || [];

  const pendingCount = pendingReqs.data?.meta?.total ?? 0;
  const activeCount = activeReqs.data?.meta?.total ?? 0;
  const unreadNotifs = Array.isArray(notifications.data?.data)
    ? notifications.data.data.filter((n) => !n.read).length
    : 0;
  const recs = Array.isArray(recommendations.data?.data)
    ? recommendations.data.data
    : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 40, animation: "fadeIn 0.5s ease-out" }}>
      {isAdmin && (
        <section className="glass" style={{ padding: 24, borderRadius: 24, border: "1px solid var(--color-primary-light)" }}>
          <AdminDashboard />
        </section>
      )}

      <section>
        <PageHeader
          title={isAdmin ? "My Workspace" : `Welcome back, ${user?.full_name?.split(" ")[0] ?? "there"}`}
          subtitle="Here's an overview of your personal access and activity"
        />

        {/* -- Supervisor View: Peer Recommendations & Certification -- */}
        {isSupervisor && (
          <>
            {teamRecs.length > 0 && (
              <div className="card glass" style={{ 
                marginBottom: 40, 
                marginTop: 20, 
                border: "1px solid var(--color-primary-light)", 
                background: "linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, rgba(37, 99, 235, 0.02) 100%)",
                boxShadow: "0 20px 40px rgba(37, 99, 235, 0.1)"
              }}>
                <div className="card-header" style={{ padding: "24px 30px" }}>
                  <div>
                    <span className="card-title" style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--color-primary)", fontSize: "1.5rem", fontWeight: 800 }}>
                      <Sparkles size={28} /> IGA Peer Recommendations
                    </span>
                    <p className="text-muted mt-1">AI-driven access governance suggestions for your team</p>
                  </div>
                  <span className="badge" style={{ background: "var(--color-primary)", color: "#fff", padding: "8px 16px", borderRadius: 20, fontWeight: 700 }}>
                    {teamRecs.length} Flagged Items
                  </span>
                </div>
                <div style={{ padding: "0 30px 30px" }}>
                   <IGARecommendationPanel results={teamRecs} isLoading={managerReview.isLoading} />
                </div>
              </div>
            )}

            {/* -- Supervisor KPI Grid -- */}
            <div className="kpi-grid" style={{ marginBottom: 40 }}>
              <div className="kpi-card">
                <div className="kpi-icon blue"><FileText size={24} /></div>
                <div className="kpi-label">Pending Approval</div>
                <div className="kpi-value">{pendingReqs.isLoading ? "-" : pendingCount}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-icon green"><CheckCircle size={24} /></div>
                <div className="kpi-label">Approved Requests</div>
                <div className="kpi-value">{recentReqs.isLoading ? "-" : activeCount}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-icon amber"><Bell size={24} /></div>
                <div className="kpi-label">Unread Notifications</div>
                <div className="kpi-value">{notifications.isLoading ? "-" : unreadNotifs}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-icon blue"><Lightbulb size={24} /></div>
                <div className="kpi-label">AI Recommendations</div>
                <div className="kpi-value">{recommendations.isLoading ? "-" : recs.length}</div>
              </div>
            </div>

            {(certifications.data?.data?.length ?? 0) > 0 && (
              <div style={{ marginBottom: 40 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "var(--color-gray-900)", display: "flex", alignItems: "center", gap: 10 }}>
                    <ClipboardList size={24} className="text-primary" /> Active Certifications
                  </h3>
                  <Link to="/supervisor/certifications/history" className="text-sm font-bold text-primary">View All History →</Link>
                </div>
                <div className="grid-12">
                  {(certifications.data?.data || []).map((cert) => {
                    const pct = cert.total_items > 0 ? Math.round(((cert.certified_count + cert.revoked_count) / cert.total_items) * 100) : 0;
                    return (
                      <div key={cert.id} className="span-6 card glass" style={{ border: "1px solid var(--color-primary-light)", padding: 24, borderRadius: 20 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                          <div>
                            <div className="font-bold text-lg" style={{ color: "var(--color-gray-900)" }}>{cert.name}</div>
                            <div className="text-xs text-muted mt-1">Deadline: {formatDate(cert.end_date)}</div>
                          </div>
                          <StatusBadge status={cert.status} />
                        </div>
                        <div style={{ marginBottom: 20 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <span className="text-xs font-semibold text-muted">Completion</span>
                            <span className="text-xs font-bold text-primary">{pct}%</span>
                          </div>
                          <div className="progress-bar" style={{ height: 6, background: "var(--color-gray-100)", borderRadius: 3 }}>
                            <div className="progress-bar-fill" style={{ width: `${pct}%`, background: "var(--color-primary)", height: "100%", borderRadius: 3 }} />
                          </div>
                          <div className="text-xs text-muted" style={{ marginTop: 6 }}>
                            {cert.pending_count} pending · {cert.certified_count + cert.revoked_count} completed
                          </div>
                        </div>
                        <Link to={`/supervisor/certifications/my-tasks/${cert.id}`} className="btn btn-sm btn-primary w-full" style={{ justifyContent: "center" }}>
                          Review Tasks
                        </Link>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {!isSupervisor && (
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-icon blue"><FileText size={24} /></div>
              <div className="kpi-label">Pending Requests</div>
              <div className="kpi-value">{pendingReqs.isLoading ? "-" : pendingCount}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon green"><CheckCircle size={24} /></div>
              <div className="kpi-label">Active Access</div>
              <div className="kpi-value">{recentReqs.isLoading ? "-" : activeCount}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon amber"><Bell size={24} /></div>
              <div className="kpi-label">Unread Notifications</div>
              <div className="kpi-value">{notifications.isLoading ? "-" : unreadNotifs}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon blue"><Lightbulb size={24} /></div>
              <div className="kpi-label">AI Recommendations</div>
              <div className="kpi-value">{recommendations.isLoading ? "-" : recs.length}</div>
            </div>
          </div>
        )}

        {/* Personal Recommendations */}
        {recs.length > 0 && (
          <div className="card glass" style={{ marginBottom: 40, border: "1px solid var(--color-success-light)", background: "linear-gradient(135deg, rgba(34, 197, 94, 0.05) 0%, rgba(34, 197, 94, 0) 100%)" }}>
            <div className="card-header">
              <span className="card-title" style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--color-success)" }}>
                <Sparkles size={20} /> AI Recommended Access
              </span>
            </div>
            <div className="grid-12" style={{ padding: "0 20px 20px" }}>
              {recs.map((s: any, idx: number) => (
                <div key={idx} className="span-4 kpi-card" style={{ background: "#fff", border: "1px solid var(--color-gray-100)", display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="text-sm font-bold">{s.entitlement}</span>
                    <span className="text-xs font-black" style={{ color: "var(--color-success)" }}>{s.confidence}% Match</span>
                  </div>
                  <div className="text-xs text-muted mt-2" style={{ flex: 1 }}>{s.reason}</div>
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
                    <Link to="/requests/new" className="btn btn-sm btn-primary" style={{ fontSize: "0.75rem", padding: "6px 12px" }}>Request Now →</Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid-12">
          {/* Recent Requests */}
          <div className="card span-6">
            <div className="card-header">
              <span className="card-title">Recent Requests</span>
              <Link to="/requests" className="text-sm font-bold" style={{ color: "var(--color-primary)" }}>View All Activity →</Link>
            </div>
            {recentReqs.isLoading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: 20 }}>
                {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 50, borderRadius: 12 }} />)}
              </div>
            ) : recentReqs.isError ? (
              <div className="error-state">
                <AlertTriangle size={24} className="text-danger" />
                <span className="text-sm font-medium">{getErrorMessage(recentReqs.error)}</span>
              </div>
            ) : (Array.isArray(recentReqs.data?.data) ? recentReqs.data.data : []).length === 0 ? (
              <p className="text-sm text-muted" style={{ textAlign: "center", padding: "40px 0" }}>No requests yet. <Link to="/requests/new" className="font-bold">Request access now ?</Link></p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "0 20px 20px" }}>
                {(Array.isArray(recentReqs.data?.data) ? recentReqs.data.data : []).map((r) => (
                  <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 0", borderBottom: "1px solid var(--color-gray-100)" }}>
                    <div>
                      <div className="font-bold text-sm" style={{ color: "var(--color-gray-900)" }}>Open DS</div>
                      <div className="text-xs text-muted mt-1">{r.application_name} · {formatDate(r.submitted_at)}</div>
                    </div>
                    <StatusBadge status={r.access_type === "TIME_BASED" ? "EXPIRED" : r.status} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notifications */}
          <div className="card span-6">
            <div className="card-header">
              <span className="card-title">Notifications</span>
              <Link to="/notifications" className="text-sm font-bold" style={{ color: "var(--color-primary)" }}>Manage All →</Link>
            </div>
            {notifications.isLoading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: 20 }}>
                {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 50, borderRadius: 12 }} />)}
              </div>
            ) : (Array.isArray(notifications.data?.data) ? notifications.data.data : []).length === 0 ? (
              <p className="text-sm text-muted" style={{ textAlign: "center", padding: "40px 0" }}>All caught up! No new notifications.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "0 20px 20px" }}>
                {(Array.isArray(notifications.data?.data) ? notifications.data.data : []).slice(0, 5).map((n) => {
                  const isSpecial = n.title.includes("Welcome") || n.title.includes("MFA") || n.title.includes("Access");
                  return (
                    <div key={n.id} style={{ 
                      padding: "16px", 
                      borderRadius: 12,
                      background: isSpecial ? "rgba(37, 99, 235, 0.03)" : "transparent",
                      borderBottom: isSpecial ? "none" : "1px solid var(--color-gray-100)",
                      marginBottom: 4,
                      transition: "var(--transition)"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                        <div>
                          <div className="font-bold text-sm" style={{ color: "var(--color-gray-900)" }}>{n.title}</div>
                          <div className="text-xs text-muted mt-1 leading-relaxed">{n.message}</div>
                        </div>
                        <div className="text-xs font-medium text-muted" style={{ whiteSpace: "nowrap" }}>{formatRelative(n.created_at)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}



