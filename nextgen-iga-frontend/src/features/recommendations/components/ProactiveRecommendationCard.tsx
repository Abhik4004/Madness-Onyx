import React from 'react';
import { ShieldCheck, ShieldAlert, ShieldQuestion, Info, Zap, Target, BarChart3 } from 'lucide-react';
import type { AccessRecommendation } from '../../../types/recommendation.types';
import '../recommendations.css';

interface ProactiveRecommendationCardProps {
  recommendation: AccessRecommendation;
}

const getStatusStyles = (decision: AccessRecommendation['decision']) => {
  switch (decision) {
    case 'STRONGLY_RECOMMEND':
      return {
        color: '#22c55e',
        bg: 'rgba(34, 197, 94, 0.05)',
        light: '#dcfce7',
        icon: <ShieldCheck size={24} />,
        label: 'Highly Recommended'
      };
    case 'RECOMMEND_WITH_CAUTION':
      return {
        color: '#f59e0b',
        bg: 'rgba(245, 158, 11, 0.05)',
        light: '#fef3c7',
        icon: <ShieldQuestion size={24} />,
        label: 'Review with Caution'
      };
    case 'DO_NOT_RECOMMEND':
      return {
        color: '#ef4444',
        bg: 'rgba(239, 68, 68, 0.05)',
        light: '#fee2e2',
        icon: <ShieldAlert size={24} />,
        label: 'Security Risk Warning'
      };
    default:
      return {
        color: '#64748b',
        bg: '#f8fafc',
        light: '#f1f5f9',
        icon: <Info size={24} />,
        label: 'Governance Advice'
      };
  }
};

export const ProactiveRecommendationCard: React.FC<ProactiveRecommendationCardProps> = ({ recommendation }) => {
  const styles = getStatusStyles(recommendation.decision);

  return (
    <div 
      className="proactive-recommendation-card proactive-card-gradient iga-recommendation-item" 
      style={{ 
        '--styles-color-light': styles.light,
        borderRadius: 28,
        padding: 32,
        border: `1px solid ${styles.color}20`,
        boxShadow: '0 20px 50px rgba(0,0,0,0.06)',
        overflow: 'hidden'
      } as React.CSSProperties}
    >
      {/* Decorative background element */}
      <div style={{ 
        position: 'absolute', 
        top: -30, 
        right: -30, 
        color: `${styles.color}08`,
        transform: 'rotate(-15deg)',
        pointerEvents: 'none'
      }}>
        {React.cloneElement(styles.icon as React.ReactElement<any>, { size: 180 })}
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
             <div style={{ 
               background: `linear-gradient(135deg, ${styles.color} 0%, ${styles.color}cc 100%)`, 
               color: '#fff', 
               padding: 12, 
               borderRadius: 14,
               boxShadow: `0 12px 24px ${styles.color}40`
             }}>
               {styles.icon}
             </div>
             <div>
               <div className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: styles.color, opacity: 0.8 }}>
                 IGA Intelligence Assistant
               </div>
               <div className="text-3xl font-black" style={{ color: 'var(--color-gray-900)', letterSpacing: '-0.5px' }}>
                 {styles.label}
               </div>
             </div>
           </div>

           <div style={{ textAlign: 'right' }}>
              <div className="text-xs font-black text-muted uppercase tracking-wider mb-1">Decision Confidence</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                 <div className="text-2xl font-black" style={{ color: 'var(--color-gray-900)' }}>{recommendation.confidence}%</div>
                 <div style={{ width: 40, height: 4, background: 'var(--color-gray-100)', borderRadius: 2 }}>
                    <div style={{ width: `${recommendation.confidence}%`, height: '100%', background: styles.color, borderRadius: 2 }} />
                 </div>
              </div>
           </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
          <div className="recommendation-stat-card" style={{ borderLeft: `4px solid ${styles.color}` }}>
            <div className="text-[10px] text-muted font-black uppercase tracking-wider mb-1">Status</div>
            <div className="text-sm font-black" style={{ color: styles.color }}>{recommendation.decision.replace(/_/g, ' ')}</div>
          </div>
          <div className="recommendation-stat-card" style={{ borderLeft: `4px solid ${styles.color}` }}>
            <div className="text-[10px] text-muted font-black uppercase tracking-wider mb-1">Risk Tier</div>
            <div className="text-sm font-black" style={{ color: styles.color, textTransform: 'capitalize' }}>{recommendation.risk_level}</div>
          </div>
          <div className="recommendation-stat-card">
            <div className="text-[10px] text-muted font-black uppercase tracking-wider mb-1">Peer Similarity</div>
            <div className="text-sm font-black" style={{ color: 'var(--color-gray-900)' }}>{recommendation.score}/100</div>
          </div>
          <div className="recommendation-stat-card">
            <div className="text-[10px] text-muted font-black uppercase tracking-wider mb-1">Entitlements</div>
            <div className="text-sm font-black" style={{ color: 'var(--color-gray-900)' }}>Standard</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>
          <div className="glass" style={{ padding: 20, background: 'rgba(255,255,255,0.4)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.8)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
               <Target size={16} className="text-muted" />
               <div className="text-xs text-muted font-black uppercase tracking-wider">Team Adoption</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="text-3xl font-black">{recommendation.breakdown.same_manager.percentage}</div>
              <div className="text-xs text-muted font-medium">
                {recommendation.breakdown.same_manager.with_access} of {recommendation.breakdown.same_manager.total} peers
              </div>
            </div>
            <div className="adoption-bar-container" style={{ marginTop: 12 }}>
              <div className="adoption-bar-fill" style={{ width: recommendation.breakdown.same_manager.percentage, background: styles.color }} />
            </div>
          </div>

          <div className="glass" style={{ padding: 20, background: 'rgba(255,255,255,0.4)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.8)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
               <BarChart3 size={16} className="text-muted" />
               <div className="text-xs text-muted font-black uppercase tracking-wider">Enterprise Adoption</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="text-3xl font-black">{recommendation.breakdown.different_manager.percentage}</div>
              <div className="text-xs text-muted font-medium">
                {recommendation.breakdown.different_manager.with_access} users enterprise-wide
              </div>
            </div>
            <div className="adoption-bar-container" style={{ marginTop: 12 }}>
              <div className="adoption-bar-fill" style={{ width: recommendation.breakdown.different_manager.percentage, background: 'var(--color-primary)' }} />
            </div>
          </div>
        </div>

        <div style={{ 
          padding: 24, 
          background: '#fff', 
          borderRadius: 24, 
          borderLeft: `6px solid ${styles.color}`,
          boxShadow: '0 10px 30px rgba(0,0,0,0.03)',
          display: 'flex',
          gap: 16
        }}>
          <div style={{ 
            background: styles.color, 
            color: '#fff', 
            padding: 8, 
            borderRadius: 10, 
            alignSelf: 'flex-start',
            boxShadow: `0 4px 10px ${styles.color}30`
          }}>
            <Zap size={16} fill="#fff" />
          </div>
          <div>
            <div className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: styles.color }}>
              Detailed Governance Reasoning
            </div>
            <p className="text-base font-medium" style={{ color: 'var(--color-gray-800)', lineHeight: 1.7 }}>
              {recommendation.reason}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
