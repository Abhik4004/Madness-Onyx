import React from 'react';
import { AlertCircle, CheckCircle2, AlertTriangle, ShieldAlert, TrendingUp, Info, User, Shield, Zap } from 'lucide-react';
import type { AccessRecommendation, ManagerReviewResult } from '../../../types/recommendation.types';
import './recommendations.css';

interface IGARecommendationPanelProps {
  results: ManagerReviewResult[];
  isLoading?: boolean;
}

const getRecommendationColor = (decision: AccessRecommendation['decision']) => {
  switch (decision) {
    case 'STRONGLY_RECOMMEND':
      return '#22c55e'; // Vibrant green
    case 'RECOMMEND_WITH_CAUTION':
      return '#f59e0b'; // Vibrant amber
    case 'DO_NOT_RECOMMEND':
      return '#ef4444'; // Vibrant red
    default:
      return '#64748b';
  }
};

const getRecommendationIcon = (decision: AccessRecommendation['decision']) => {
  switch (decision) {
    case 'STRONGLY_RECOMMEND':
      return <CheckCircle2 size={18} />;
    case 'RECOMMEND_WITH_CAUTION':
      return <AlertTriangle size={18} />;
    case 'DO_NOT_RECOMMEND':
      return <ShieldAlert size={18} />;
    default:
      return <Info size={18} />;
  }
};

export const IGARecommendationPanel: React.FC<IGARecommendationPanelProps> = ({ results, isLoading }) => {
  if (isLoading) {
    return (
      <div className="skeleton-list">
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton" style={{ height: 120, marginBottom: 16, borderRadius: 20 }} />
        ))}
      </div>
    );
  }

  if (!results || results.length === 0) {
    return (
      <div className="text-center py-20 glass" style={{ borderRadius: 24, background: 'rgba(255,255,255,0.4)' }}>
        <div style={{ background: 'var(--color-gray-100)', color: 'var(--color-gray-400)', width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <Shield size={32} />
        </div>
        <div className="text-lg font-bold" style={{ color: 'var(--color-gray-800)' }}>All Clear!</div>
        <p className="text-sm text-muted mt-2 max-w-xs mx-auto">Your team's access currently aligns with all governance and security standards.</p>
      </div>
    );
  }

  return (
    <div className="iga-recommendation-panel" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {results.map((result, idx) => {
        const { recommendation, status, user_id, access_type } = result;
        const color = getRecommendationColor(recommendation.decision);
        const isHighRisk = recommendation.decision === 'DO_NOT_RECOMMEND';

        return (
          <div 
            key={`${user_id}-${access_type}-${idx}`} 
            className="iga-recommendation-item glass" 
            style={{ 
              padding: 24, 
              borderRadius: 24, 
              borderLeft: `8px solid ${color}`,
              background: 'rgba(255, 255, 255, 0.7)',
              backdropFilter: 'blur(12px)',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.04)',
              animationDelay: `${idx * 0.1}s`
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div style={{ display: 'flex', gap: 16 }}>
                <div style={{ 
                  width: 52, 
                  height: 52, 
                  borderRadius: 16, 
                  background: `linear-gradient(135deg, ${color}20 0%, ${color}05 100%)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: color,
                  border: `1px solid ${color}30`
                }}>
                  <User size={26} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <span className="font-black text-xl" style={{ color: 'var(--color-gray-900)', letterSpacing: '-0.5px' }}>{user_id}</span>
                    <span className={`badge ${isHighRisk ? 'recommendation-badge-pulse' : ''}`} style={{ 
                      background: status === 'risky_access' ? '#fee2e2' : '#dcfce7',
                      color: status === 'risky_access' ? '#ef4444' : '#22c55e',
                      fontSize: '0.65rem',
                      fontWeight: 900,
                      padding: '4px 10px',
                      borderRadius: 8,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      {status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="text-sm font-bold" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-gray-500)' }}>
                     Targeting Access: <span style={{ color: 'var(--color-primary)', fontWeight: 800 }}>{access_type}</span>
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: 8, 
                  padding: '8px 16px', 
                  borderRadius: 14, 
                  background: `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)`, 
                  color: '#fff',
                  fontWeight: 900,
                  fontSize: '0.75rem',
                  boxShadow: `0 10px 20px ${color}30`,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  {getRecommendationIcon(recommendation.decision)}
                  {recommendation.decision.replace(/_/g, ' ')}
                </div>
                <div className="text-xs font-black mt-3" style={{ color: 'var(--color-gray-400)' }}>
                  GOVERNANCE SCORE: <span style={{ color: 'var(--color-gray-900)' }}>{recommendation.score}</span> · CONFIDENCE: <span style={{ color: 'var(--color-gray-900)' }}>{recommendation.confidence}%</span>
                </div>
              </div>
            </div>

            <div className="grid-12" style={{ gap: 20, marginBottom: 20 }}>
              <div className="span-6 recommendation-stat-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 }}>
                  <div className="text-xs text-muted uppercase font-black" style={{ letterSpacing: 0.5 }}>Team Adoption</div>
                  <div className="text-sm font-black">{recommendation.breakdown.same_manager.percentage}</div>
                </div>
                <div className="adoption-bar-container">
                  <div className="adoption-bar-fill" style={{ width: recommendation.breakdown.same_manager.percentage, background: color }} />
                </div>
                <div className="text-xs text-muted mt-2 font-medium">
                  Used by {recommendation.breakdown.same_manager.with_access} of {recommendation.breakdown.same_manager.total} direct reports
                </div>
              </div>
              <div className="span-6 recommendation-stat-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 }}>
                  <div className="text-xs text-muted uppercase font-black" style={{ letterSpacing: 0.5 }}>Org Adoption</div>
                  <div className="text-sm font-black">{recommendation.breakdown.different_manager.percentage}</div>
                </div>
                <div className="adoption-bar-container">
                  <div className="adoption-bar-fill" style={{ width: recommendation.breakdown.different_manager.percentage, background: 'var(--color-primary)' }} />
                </div>
                <div className="text-xs text-muted mt-2 font-medium">
                  Used by {recommendation.breakdown.different_manager.with_access} users across the enterprise
                </div>
              </div>
            </div>

            <div style={{ 
              display: 'flex', 
              alignItems: 'flex-start', 
              gap: 14, 
              padding: '16px 20px', 
              background: `linear-gradient(to right, ${color}08, transparent)`, 
              borderRadius: 16, 
              border: `1px solid ${color}15` 
            }}>
              <div style={{ 
                background: color, 
                color: '#fff', 
                padding: 6, 
                borderRadius: 8, 
                marginTop: 2, 
                boxShadow: `0 4px 8px ${color}20` 
              }}>
                <Zap size={14} fill="#fff" />
              </div>
              <p className="text-sm font-medium" style={{ color: 'var(--color-gray-700)', lineHeight: 1.6 }}>
                <span className="font-black" style={{ color: color, textTransform: 'uppercase', fontSize: '0.7rem', marginRight: 8 }}>AI Insight:</span> 
                {recommendation.reason}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};
