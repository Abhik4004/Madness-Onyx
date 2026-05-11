import { useQuery } from '@tanstack/react-query';
import { FileText, CheckCircle, Bell, Lightbulb, AlertTriangle, Sparkles, Download, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/layout/PageHeader';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { requestsApi } from '../../api/requests.api';
import { notificationsApi } from '../../api/notifications.api';
import { recommendationsApi } from '../../api/recommendations.api';
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

  const recommendations = useQuery({
    queryKey: ['recommendations', user?.id],
    queryFn: () => recommendationsApi.getUserRecommendations(user!.id),
    enabled: !!user,
  });
  
  const certifications = useQuery({
    queryKey: ['certifications', { status: 'ACTIVE' }],
    queryFn: () => certificationApi.list({ status: 'ACTIVE' }),
    enabled: isSupervisor,
  });

  const teamRecommendations = useQuery({
    queryKey: ['recommendations', 'team', user?.id],
    queryFn: () => recommendationsApi.getTeamRecommendations(user!.id),
    enabled: isSupervisor && !!user,
  });

  const teamRecs = (teamRecommendations.data as any)?.team_recommendations || [];

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
                      <Sparkles size={28} /> Peer Recommendations
                    </span>
                    <p className="text-muted mt-1">AI-driven access suggestions for your team members and new joinees</p>
                  </div>
                  <span className="badge" style={{ background: "var(--color-primary)", color: "#fff", padding: "8px 16px", borderRadius: 20, fontWeight: 700 }}>
                    {teamRecs.length} Members Need Attention
                  </span>
                </div>
                <div className="grid-12" style={{ padding: "0 30px 30px" }}>
                  {teamRecs.map((member: any) => (
                    <div key={member.userId} className="span-6 glass" style={{ background: "#fff", border: "1px solid var(--color-gray-100)", padding: 24, borderRadius: 20 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div className="avatar-sm" style={{ background: "var(--color-primary-light)", color: "var(--color-primary)", fontWeight: 700 }}>
                            {member.userName[0]}
                          </div>
                          <div>
                            <div className="font-bold" style={{ fontSize: "1.1rem", color: "var(--color-gray-900)" }}>{member.userName}</div>
                            <div className="text-xs text-muted">Direct Report</div>
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {member.suggestions.map((s: any, idx: number) => (
                          <div key={idx} className="suggestion-item" style={{ padding: 16, background: "var(--color-gray-50)", borderRadius: 16, border: "1px solid var(--color-gray-100)", transition: "transform 0.2s" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span className="text-sm font-bold" style={{ color: "var(--color-gray-800)" }}>{s.entitlement}</span>
                              <span className="text-xs font-black" style={{ color: "var(--color-success)", background: "rgba(34, 197, 94, 0.1)", padding: "4px 8px", borderRadius: 6 }}>{s.confidence}% MATCH</span>
                            </div>
                            <div className="text-xs text-muted mt-2" style={{ lineHeight: 1.5 }}>{s.reason}</div>
                            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
                              <Link to="/requests/new" className="btn btn-sm btn-primary" style={{ borderRadius: 8, fontSize: "0.75rem", fontWeight: 600 }}>Provision Now →</Link>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

                        {/* -- Team Request Status Boxes -- */}
            <div className="grid-12" style={{ marginBottom: 40 }}>
              <div className="span-6 card glass" style={{ background: "rgba(245, 158, 11, 0.05)", border: "1px solid rgba(245, 158, 11, 0.2)", padding: 24, borderRadius: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <span style={{ fontWeight: 800, color: "var(--color-amber-600)", display: "flex", alignItems: "center", gap: 8 }}>
                    <Clock size={20} /> Pending Approval
                  </span>
                  <span className="badge" style={{ background: "var(--color-amber-500)", color: "#fff" }}>{pendingCount} Tasks</span>
                </div>
                <div className="text-sm text-muted mb-4">Requests requiring your immediate review and decision</div>
                <Link to="/requests" className="btn btn-sm btn-primary" style={{ background: "var(--color-amber-500)", border: "none" }}>Review Now →</Link>
              </div>
              <div className="span-6 card glass" style={{ background: "rgba(34, 197, 94, 0.05)", border: "1px solid rgba(34, 197, 94, 0.2)", padding: 24, borderRadius: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <span style={{ fontWeight: 800, color: "var(--color-success)", display: "flex", alignItems: "center", gap: 8 }}>
                    <CheckCircle size={20} /> Approved Requests
                  </span>
                  <span className="badge" style={{ background: "var(--color-success)", color: "#fff" }}>{activeCount} Total</span>
                </div>
                <div className="text-sm text-muted mb-4">Summary of successfully provisioned access for your team</div>
                <Link to="/requests" className="text-sm font-bold" style={{ color: "var(--color-success)" }}>View History →</Link>
              </div>
            </div>

            {(certifications.data?.data?.length ?? 0) > 0 && (
              <div className="card" style={{ 
                background: "var(--grad-primary)", 
                color: "white", 
                border: "none",
                padding: 30,
                borderRadius: 24,
                marginBottom: 40,
                boxShadow: "0 15px 35px rgba(37, 99, 235, 0.25)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <div>
                  <h3 style={{ fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.5px" }}>Certification Campaign Active</h3>
                  <p style={{ opacity: 0.9, marginTop: 6, fontSize: "1rem" }}>You have {certifications.data?.data?.length ?? 0} campaign(s) requiring your review.</p>
                </div>
                <Link to="/supervisor/certifications/my-tasks" className="btn btn-lg" style={{ background: "white", color: "var(--color-primary)", fontWeight: 700, padding: "12px 30px", borderRadius: 12 }}>
                  Perform Reviews →
                </Link>
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



