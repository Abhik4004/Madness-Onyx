import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Lightbulb, Check, X, Sparkles, TrendingUp, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/layout/PageHeader';
import { AIChatbot } from '../ai/AIChatbot';
import { igaRecommendationApi } from '../../api/iga-recommendation.api';
import { IGARecommendationPanel } from './components/IGARecommendationPanel';
import { usePermissions } from '../../hooks/usePermissions';
import { aiApi } from '../../api/ai.api';
import { useAuth } from '../../hooks/useAuth';
import { formatRelative } from '../../lib/utils';

export function RecommendationsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { isSupervisor } = usePermissions();

  const managerReview = useQuery({
    queryKey: ['iga-recommendations', 'manager-review', user?.id],
    queryFn: () => igaRecommendationApi.getManagerReview(user!.id),
    enabled: !!user && isSupervisor,
  });

  const teamRecs = managerReview.data?.results || [];

  const aiInsightQuery = useQuery({
    queryKey: ['ai', 'rec-insight', user?.id],
    queryFn: () => aiApi.getRecommendationInsight(user!.id),
    enabled: !!user,
  });

  // Old mutations removed

  const recs = recsQuery.data?.data ?? [];
  const pending = recs.filter(r => r.status === 'PENDING');
  const risk = riskQuery.data?.data;
  const aiInsight = aiInsightQuery.data;

  return (
    <div>
      <PageHeader
        title="AI Access Recommendations"
        subtitle="Personalised access suggestions based on your role, peers, and usage patterns"
      />

      <div className="card glass" style={{ marginBottom: 32, border: '1px solid var(--color-primary-light)', background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.03) 0%, rgba(37, 99, 235, 0.01) 100%)' }}>
        <div className="card-header" style={{ padding: '24px 30px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ padding: 12, background: 'var(--color-primary)', color: '#fff', borderRadius: 14, boxShadow: '0 8px 16px rgba(37, 99, 235, 0.2)' }}>
              <Sparkles size={24} />
            </div>
            <div>
              <span className="card-title" style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-gray-900)' }}>
                IGA Peer Recommendation Intelligence
              </span>
              <p className="text-muted text-xs font-medium mt-1">Real-time risk scoring and adoption analytics for your direct reports</p>
            </div>
          </div>
        </div>
        
        <div style={{ padding: '0 30px 30px' }}>
           {!isSupervisor ? (
             <div className="text-center py-12">
               <div className="text-muted mb-2">Personal recommendations are currently handled by your manager.</div>
               <p className="text-xs">Contact your supervisor for access suggestions based on your role.</p>
             </div>
           ) : (
             <IGARecommendationPanel results={teamRecs} isLoading={managerReview.isLoading} />
           )}
        </div>
      </div>

      {/* Floating chatbot — recommendation context */}
      <AIChatbot
        context={{ page: 'recommendation' }}
        initialMessage="I can explain why these access items are recommended and help you evaluate the risk. Ask me anything!"
      />
    </div>
  );
}
