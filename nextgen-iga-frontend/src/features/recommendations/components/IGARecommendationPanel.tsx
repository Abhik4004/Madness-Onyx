import React from 'react';
import { AlertCircle, CheckCircle2, AlertTriangle, ShieldAlert, TrendingUp, Info } from 'lucide-react';
import type { AccessRecommendation, ManagerReviewResult } from '../../../types/recommendation.types';

interface IGARecommendationPanelProps {
  results: ManagerReviewResult[];
  isLoading?: boolean;
}

const getRecommendationColor = (decision: AccessRecommendation['decision']) => {
  switch (decision) {
    case 'STRONGLY_RECOMMEND':
      return 'var(--color-success)';
    case 'RECOMMEND_WITH_CAUTION':
      return 'var(--color-warning)';
    case 'DO_NOT_RECOMMEND':
      return 'var(--color-danger)';
    default:
      return 'var(--color-gray-500)';
  }
};

const getRecommendationIcon = (decision: AccessRecommendation['decision']) => {
  switch (decision) {
    case 'STRONGLY_RECOMMEND':
      return <CheckCircle2 size={16} />;
    case 'RECOMMEND_WITH_CAUTION':
      return <AlertTriangle size={16} />;
    case 'DO_NOT_RECOMMEND':
      return <ShieldAlert size={16} />;
    default:
      return <Info size={16} />;
  }
};

export const IGARecommendationPanel: React.FC<IGARecommendationPanelProps> = ({ results, isLoading }) => {
  if (isLoading) {
    return (
      <div className="skeleton-list">
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton" style={{ height: 100, marginBottom: 12, borderRadius: 12 }} />
        ))}
      </div>
    );
  }

  if (!results || results.length === 0) {
    return (
      <div className="text-center py-12 glass" style={{ borderRadius: 16 }}>
        <div className="text-muted mb-2">No recommendations found</div>
        <p className="text-xs">Your team's access aligns with standard governance rules.</p>
      </div>
    );
  }

  return (
    <div className="iga-recommendation-panel" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {results.map((result, idx) => {
        const { recommendation, status, user_id, access_type } = result;
        const color = getRecommendationColor(recommendation.decision);

        return (
          <div 
            key={`${user_id}-${access_type}-${idx}`} 
            className="glass" 
            style={{ 
              padding: 20, 
              borderRadius: 16, 
              borderLeft: `6px solid ${color}`,
              background: 'rgba(255, 255, 255, 0.6)',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span className="font-bold text-lg" style={{ color: 'var(--color-gray-900)' }}>{user_id}</span>
                  <span className="badge" style={{ 
                    background: status === 'risky_access' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                    color: status === 'risky_access' ? 'var(--color-danger)' : 'var(--color-success)',
                    fontSize: '0.7rem',
                    fontWeight: 800,
                    textTransform: 'uppercase'
                  }}>
                    {status.replace('_', ' ')}
                  </span>
                </div>
                <div className="text-sm font-semibold text-muted" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                   Access: <span style={{ color: 'var(--color-primary)' }}>{access_type}</span>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: 6, 
                  padding: '4px 12px', 
                  borderRadius: 20, 
                  background: `${color}15`, 
                  color: color,
                  fontWeight: 800,
                  fontSize: '0.75rem'
                }}>
                  {getRecommendationIcon(recommendation.decision)}
                  {recommendation.decision.replace(/_/g, ' ')}
                </div>
                <div className="text-xs text-muted mt-2">
                  Score: <span className="font-bold">{recommendation.score}</span> · Confidence: <span className="font-bold">{recommendation.confidence}%</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, padding: 16, background: 'rgba(0,0,0,0.02)', borderRadius: 12, marginBottom: 16 }}>
              <div>
                <div className="text-xs text-muted uppercase font-bold mb-2" style={{ letterSpacing: 0.5 }}>Peer Adoption (Same Manager)</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="text-xl font-black" style={{ color: 'var(--color-gray-800)' }}>{recommendation.breakdown.same_manager.percentage}</div>
                  <div className="text-xs text-muted">
                    {recommendation.breakdown.same_manager.with_access} / {recommendation.breakdown.same_manager.total} users
                  </div>
                </div>
              </div>
              <div>
                <div className="text-xs text-muted uppercase font-bold mb-2" style={{ letterSpacing: 0.5 }}>Org Adoption</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="text-xl font-black" style={{ color: 'var(--color-gray-800)' }}>{recommendation.breakdown.different_manager.percentage}</div>
                  <div className="text-xs text-muted">
                    {recommendation.breakdown.different_manager.with_access} / {recommendation.breakdown.different_manager.total} users
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: 12, background: `${color}05`, borderRadius: 10, border: `1px solid ${color}20` }}>
              <Info size={14} style={{ color: color, marginTop: 2, flexShrink: 0 }} />
              <p className="text-sm" style={{ color: 'var(--color-gray-700)', lineHeight: 1.5 }}>
                <span className="font-bold" style={{ color: color }}>Recommendation:</span> {recommendation.reason}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};
