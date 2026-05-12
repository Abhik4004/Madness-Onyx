import { useQuery } from '@tanstack/react-query';
import { Lightbulb, User, Shield, ArrowRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/layout/PageHeader';
import { igaRecommendationApi } from '../../api/iga-recommendation.api';
import { IGARecommendationPanel } from './components/IGARecommendationPanel';
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
    queryKey: ['iga-recommendations', 'manager-review', user?.id],
    queryFn: () => igaRecommendationApi.getManagerReview(user!.id),
    enabled: !!user,
  });

  const teamRecs = response?.results || [];

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
          <h3>No New Governance Items</h3>
          <p className="text-muted" style={{ maxWidth: 400, margin: '10px auto 0' }}>
            Your team members already have all standard access entitlements for their roles.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className="alert alert-info mb-4" style={{ borderRadius: 16 }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Shield size={20} />
                <span className="text-sm font-bold">IGA Governance Review: The following items have been flagged for your review based on peer adoption and risk scoring.</span>
             </div>
          </div>
          <IGARecommendationPanel results={teamRecs} isLoading={isLoading} />
        </div>
      )}
    </div>
  );
}
