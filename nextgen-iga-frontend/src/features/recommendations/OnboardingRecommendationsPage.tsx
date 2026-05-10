import { useQuery } from '@tanstack/react-query';
import { Lightbulb, User, Shield, ArrowRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/layout/PageHeader';
import { recommendationsApi } from '../../api/recommendations.api';
import { useAuth } from '../../hooks/useAuth';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { requestsApi } from '../../api/requests.api';
import { toast } from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';

export function OnboardingRecommendationsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  const { data: response, isLoading } = useQuery({
    queryKey: ['recommendations', 'team', user?.id],
    queryFn: () => recommendationsApi.getTeamRecommendations(user!.id),
    enabled: !!user,
  });

  const teamRecs = (response as any)?.team_recommendations || [];

  const handleProvisionAll = async (member: any) => {
    const toastId = toast.loading(`Provisioning ${member.suggestions.length} items for ${member.userName}...`);
    try {
      const promises = member.suggestions.map((s: any) => 
        requestsApi.create({
          resourceId: s.resourceId || s.entitlement.toLowerCase(),
          application_name: s.entitlement,
          role: 'viewer',
          targetUserId: member.userId,
          justification: `Auto-provisioning based on AI recommendation (Onboarding).`,
        })
      );
      
      await Promise.all(promises);
      toast.success(`Success! All access granted for ${member.userName}. Redirecting to approvals...`);
      
      // Refresh the data to clear the recommendations
      queryClient.invalidateQueries({ queryKey: ['recommendations', 'team'] });
      navigate("/supervisor/approvals");
    } catch (err: any) {
      toast.error(`Provisioning failed: ${err.message}. Redirecting to approvals...`);
      navigate("/supervisor/approvals");
    }
  };

  const handleProvisionOne = async (member: any, suggestion: any) => {
    const toastId = toast.loading(`Granting ${suggestion.entitlement}...`);
    try {
      await requestsApi.create({
        resourceId: suggestion.resourceId || suggestion.entitlement.toLowerCase(),
        application_name: suggestion.entitlement,
        role: 'viewer',
        targetUserId: member.userId,
        justification: `AI Recommendation: ${suggestion.reason}`,
      });
      toast.success(`Access granted for ${suggestion.entitlement}. Redirecting to approvals...`);
      queryClient.invalidateQueries({ queryKey: ['recommendations', 'team'] });
      navigate("/supervisor/approvals");
    } catch (err: any) {
      toast.error(`Provisioning failed: ${err.message}. Redirecting to approvals...`);
      navigate("/supervisor/approvals");
    }
  };

  return (
    <div className="fade-in">
      <PageHeader
        title="Onboarding Recommendations"
        subtitle="Access suggestions for your direct reports based on peer adoption"
      />

      {isLoading ? (
        <div className="skeleton-list">
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 100, marginBottom: 20, borderRadius: 12 }} />)}
        </div>
      ) : teamRecs.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ background: 'var(--color-gray-100)', width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <Lightbulb size={32} className="text-muted" />
          </div>
          <h3>No New Suggestions</h3>
          <p className="text-muted" style={{ maxWidth: 400, margin: '10px auto 0' }}>
            Your team members already have all standard access entitlements for their roles.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {teamRecs.map((member: any) => (
            <div key={member.userId} className="card hover-glow" style={{ borderLeft: '4px solid var(--color-primary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ background: 'var(--color-primary-lightest)', color: 'var(--color-primary)', width: 40, height: 40, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <User size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{member.userName}</h3>
                    <p className="text-xs text-muted">ID: {member.userId} · Pending Setup</p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button 
                    onClick={() => handleProvisionAll(member)}
                    className="btn btn-primary btn-sm"
                    style={{ borderRadius: 8 }}
                  >
                    Grant All Access
                  </button>
                  <Link to={`/admin/users/${member.userId}`} className="btn btn-outline btn-sm">View Profile</Link>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                {member.suggestions.map((s: any, idx: number) => (
                  <div key={idx} style={{ padding: 16, background: 'var(--color-gray-50)', borderRadius: 12, border: '1px solid var(--color-gray-200)', position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Shield size={16} className="text-primary" />
                        <span className="font-bold text-sm">{s.entitlement}</span>
                      </div>
                      <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>{s.confidence}% Match</span>
                    </div>
                    
                    <p className="text-xs text-muted" style={{ margin: '12px 0' }}>{s.reason}</p>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                      <StatusBadge status={s.risk === 'high' ? 'CRITICAL' : 'ACTIVE'} />
                      <button 
                        onClick={() => handleProvisionOne(member, s)}
                        className="text-xs font-bold" 
                        style={{ background: 'none', border: 'none', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', padding: 0 }}
                      >
                        Provision Now <ArrowRight size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
