import React from 'react';
import { ShieldCheck, ShieldAlert, ShieldQuestion, Info, ArrowRight } from 'lucide-react';
import type { AccessRecommendation } from '../../../types/recommendation.types';

interface ProactiveRecommendationCardProps {
  recommendation: AccessRecommendation;
}

const getStatusStyles = (decision: AccessRecommendation['decision']) => {
  switch (decision) {
    case 'STRONGLY_RECOMMEND':
      return {
        color: 'var(--color-success)',
        bg: 'rgba(34, 197, 94, 0.05)',
        border: 'var(--color-success)',
        icon: <ShieldCheck size={24} />,
        label: 'Highly Recommended'
      };
    case 'RECOMMEND_WITH_CAUTION':
      return {
        color: 'var(--color-warning)',
        bg: 'rgba(245, 158, 11, 0.05)',
        border: 'var(--color-warning)',
        icon: <ShieldQuestion size={24} />,
        label: 'Review with Caution'
      };
    case 'DO_NOT_RECOMMEND':
      return {
        color: 'var(--color-danger)',
        bg: 'rgba(239, 68, 68, 0.05)',
        border: 'var(--color-danger)',
        icon: <ShieldAlert size={24} />,
        label: 'Risk Warning'
      };
    default:
      return {
        color: 'var(--color-gray-500)',
        bg: 'var(--color-gray-50)',
        border: 'var(--color-gray-200)',
        icon: <Info size={24} />,
        label: 'Governance Insight'
      };
  }
};

export const ProactiveRecommendationCard: React.FC<ProactiveRecommendationCardProps> = ({ recommendation }) => {
  const styles = getStatusStyles(recommendation.decision);

  return (
    <div 
      className="proactive-recommendation-card" 
      style={{ 
        background: styles.bg,
        border: `1px solid ${styles.color}40`,
        borderRadius: 20,
        padding: 24,
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Decorative background element */}
      <div style={{ 
        position: 'absolute', 
        top: -20, 
        right: -20, 
        color: `${styles.color}10`,
        transform: 'rotate(-15deg)'
      }}>
        {React.cloneElement(styles.icon as React.ReactElement, { size: 120 })}
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ 
            background: styles.color, 
            color: '#fff', 
            padding: 10, 
            borderRadius: 12,
            boxShadow: `0 10px 20px ${styles.color}30`
          }}>
            {styles.icon}
          </div>
          <div>
            <div className="text-xs font-black uppercase tracking-widest" style={{ color: styles.color }}>
              IGA Governance Assistant
            </div>
            <div className="text-2xl font-black" style={{ color: 'var(--color-gray-900)' }}>
              {styles.label}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
          <div className="glass" style={{ padding: 12, borderRadius: 12, background: '#fff' }}>
            <div className="text-xs text-muted font-bold mb-1">Decision</div>
            <div className="text-sm font-black" style={{ color: styles.color }}>{recommendation.decision.replace(/_/g, ' ')}</div>
          </div>
          <div className="glass" style={{ padding: 12, borderRadius: 12, background: '#fff' }}>
            <div className="text-xs text-muted font-bold mb-1">Risk Level</div>
            <div className="text-sm font-black" style={{ color: styles.color, textTransform: 'capitalize' }}>{recommendation.risk_level}</div>
          </div>
          <div className="glass" style={{ padding: 12, borderRadius: 12, background: '#fff' }}>
            <div className="text-xs text-muted font-bold mb-1">Confidence</div>
            <div className="text-sm font-black" style={{ color: 'var(--color-gray-900)' }}>{recommendation.confidence}%</div>
          </div>
          <div className="glass" style={{ padding: 12, borderRadius: 12, background: '#fff' }}>
            <div className="text-xs text-muted font-bold mb-1">Risk Score</div>
            <div className="text-sm font-black" style={{ color: 'var(--color-gray-900)' }}>{recommendation.score}</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          <div style={{ padding: 16, background: 'rgba(255,255,255,0.5)', borderRadius: 16, border: '1px solid var(--color-gray-100)' }}>
            <div className="text-xs text-muted font-bold mb-2">Same Manager Adoption</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="text-2xl font-black">{recommendation.breakdown.same_manager.percentage}</div>
              <div className="text-xs text-muted">
                {recommendation.breakdown.same_manager.with_access} / {recommendation.breakdown.same_manager.total} peers
              </div>
            </div>
            <div className="progress-bar" style={{ height: 4, background: 'var(--color-gray-100)', borderRadius: 2, marginTop: 8 }}>
              <div style={{ 
                height: '100%', 
                width: recommendation.breakdown.same_manager.percentage, 
                background: styles.color, 
                borderRadius: 2 
              }} />
            </div>
          </div>

          <div style={{ padding: 16, background: 'rgba(255,255,255,0.5)', borderRadius: 16, border: '1px solid var(--color-gray-100)' }}>
            <div className="text-xs text-muted font-bold mb-2">Organization Adoption</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="text-2xl font-black">{recommendation.breakdown.different_manager.percentage}</div>
              <div className="text-xs text-muted">
                {recommendation.breakdown.different_manager.with_access} / {recommendation.breakdown.different_manager.total} total
              </div>
            </div>
            <div className="progress-bar" style={{ height: 4, background: 'var(--color-gray-100)', borderRadius: 2, marginTop: 8 }}>
              <div style={{ 
                height: '100%', 
                width: recommendation.breakdown.different_manager.percentage, 
                background: 'var(--color-primary)', 
                borderRadius: 2 
              }} />
            </div>
          </div>
        </div>

        <div style={{ 
          padding: 20, 
          background: '#fff', 
          borderRadius: 16, 
          borderLeft: `4px solid ${styles.color}`,
          boxShadow: '0 4px 10px rgba(0,0,0,0.02)'
        }}>
          <div className="text-xs text-muted font-black uppercase tracking-wider mb-2" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Info size={12} /> Governance Reasoning
          </div>
          <p className="text-sm font-medium" style={{ color: 'var(--color-gray-700)', lineHeight: 1.6 }}>
            {recommendation.reason}
          </p>
        </div>
      </div>
    </div>
  );
};
