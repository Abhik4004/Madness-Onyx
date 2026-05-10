import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Lightbulb, Check, X, Sparkles, TrendingUp, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/layout/PageHeader';
import { AIChatbot } from '../ai/AIChatbot';
import { recommendationsApi } from '../../api/recommendations.api';
import { aiApi } from '../../api/ai.api';
import { useAuth } from '../../hooks/useAuth';
import { formatRelative } from '../../lib/utils';

export function RecommendationsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const recsQuery = useQuery({
    queryKey: ['recommendations', user?.id],
    queryFn: () => recommendationsApi.getUserRecommendations(user!.id),
    enabled: !!user,
  });

  const riskQuery = useQuery({
    queryKey: ['risk', user?.id],
    queryFn: () => recommendationsApi.getRiskProfile(user!.id),
    enabled: !!user,
  });

  const aiInsightQuery = useQuery({
    queryKey: ['ai', 'rec-insight', user?.id],
    queryFn: () => aiApi.getRecommendationInsight(user!.id),
    enabled: !!user,
  });

  const accept = useMutation({
    mutationFn: recommendationsApi.accept,
    onSuccess: () => { toast.success('Request created from recommendation'); qc.invalidateQueries({ queryKey: ['recommendations'] }); },
    onError: () => toast.error('Failed'),
  });

  const dismiss = useMutation({
    mutationFn: recommendationsApi.dismiss,
    onSuccess: () => { toast.success('Recommendation dismissed'); qc.invalidateQueries({ queryKey: ['recommendations'] }); },
    onError: () => toast.error('Failed'),
  });

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

      <div className="grid-2" style={{ gap: 20, marginBottom: 24 }}>
        {/* Risk Profile */}
        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingUp size={16} /> My Risk Profile
            </span>
            {risk && <span className={`badge badge-${risk.risk_level.toLowerCase()}`}>{risk.risk_level}</span>}
          </div>
          {riskQuery.isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[1,2,3].map(i => <div key={i} className="skeleton skeleton-text w-full" />)}</div>
          ) : !risk ? (
            <div className="ai-unavailable-card">
              <Sparkles size={18} />
              <span className="text-sm">Risk profile unavailable — AI service not connected</span>
            </div>
          ) : (
            <>
              <div className="risk-score" style={{ marginBottom: 12 }}>
                <span className="text-xs text-muted" style={{ width: 90 }}>Overall Risk</span>
                <div className="risk-bar">
                  <div className={`risk-fill ${risk.risk_level.toLowerCase()}`} style={{ width: `${risk.overall_score}%` }} />
                </div>
                <span className="font-bold text-sm">{risk.overall_score}<span className="text-muted font-medium">/100</span></span>
              </div>
              {risk.factors.map(f => (
                <div key={f.name} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span className="text-xs font-medium">{f.name}</span>
                    <span className="text-xs text-muted">{f.score}/100</span>
                  </div>
                  <div className="risk-bar" style={{ height: 4 }}>
                    <div className={`risk-fill ${f.score >= 70 ? 'high' : f.score >= 40 ? 'medium' : 'low'}`} style={{ width: `${f.score}%` }} />
                  </div>
                  <div className="text-xs text-muted" style={{ marginTop: 2 }}>{f.description}</div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* AI Insight */}
        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={16} color="var(--color-primary)" /> AI Insight
            </span>
          </div>
          {aiInsightQuery.isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[1,2].map(i => <div key={i} className="skeleton skeleton-text w-full" style={{ height: 18 }} />)}</div>
          ) : !aiInsight ? (
            <div className="ai-unavailable-card">
              <Sparkles size={18} />
              <span className="text-sm">AI insight unavailable — service not connected</span>
            </div>
          ) : (
            <>
              <p className="text-sm" style={{ lineHeight: 1.7, marginBottom: 12 }}>{aiInsight.summary}</p>
              <div className="text-xs font-semibold text-muted" style={{ textTransform: 'uppercase', marginBottom: 6 }}>Peer Comparison</div>
              <div style={{ background: 'var(--color-gray-50)', padding: '10px 12px', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', color: 'var(--color-gray-700)' }}>
                {aiInsight.peer_comparison}
              </div>
              {aiInsight.risk_flags.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div className="text-xs font-semibold text-muted" style={{ textTransform: 'uppercase', marginBottom: 6 }}>Risk Flags</div>
                  {aiInsight.risk_flags.map((flag, i) => (
                    <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'flex-start' }}>
                      <AlertTriangle size={12} style={{ color: 'var(--color-warning)', flexShrink: 0, marginTop: 2 }} />
                      <span className="text-xs">{flag}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Recommendations */}
      <div className="card">
        <div className="card-header">
          <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Lightbulb size={16} color="var(--color-warning)" />
            Recommendations
            {pending.length > 0 && (
              <span style={{ background: 'var(--color-warning-light)', color: '#92400e', borderRadius: 999, fontSize: '0.7rem', fontWeight: 700, padding: '1px 8px' }}>{pending.length}</span>
            )}
          </span>
        </div>

        {recsQuery.isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 'var(--radius-md)' }} />)}
          </div>
        ) : recs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon" style={{ background: 'var(--color-success-light)', color: 'var(--color-success)' }}><Check size={22} /></div>
            <div className="empty-state-title">No recommendations</div>
            <div className="empty-state-desc">The AI has no new access suggestions for you right now</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {recs.map(rec => (
              <div
                key={rec.id}
                style={{
                  border: `1px solid ${rec.status === 'PENDING' ? 'var(--color-primary-light)' : 'var(--color-gray-200)'}`,
                  borderRadius: 'var(--radius-md)',
                  padding: '14px 16px',
                  background: rec.status === 'PENDING' ? 'var(--color-gray-50)' : 'white',
                  opacity: rec.status !== 'PENDING' ? 0.7 : 1,
                  display: 'flex',
                  gap: 16,
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span className="font-semibold text-sm">{rec.application_name}</span>
                    <span className="text-muted text-sm">—</span>
                    <span className="text-sm">{rec.role_name}</span>
                  </div>
                  <div className="text-xs text-muted" style={{ marginBottom: 6 }}>{rec.reason}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="text-xs text-muted">Confidence:</span>
                    <div className="risk-bar" style={{ width: 80, height: 4 }}>
                      <div style={{ height: '100%', width: `${rec.confidence_score * 100}%`, background: rec.confidence_score > 0.7 ? 'var(--color-success)' : 'var(--color-warning)', borderRadius: 999 }} />
                    </div>
                    <span className="text-xs font-semibold">{Math.round(rec.confidence_score * 100)}%</span>
                    <span className="text-xs text-muted">· {formatRelative(rec.created_at)}</span>
                  </div>
                </div>
                {rec.status === 'PENDING' ? (
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button
                      className="btn btn-sm btn-primary"
                      disabled={accept.isPending}
                      onClick={() => accept.mutate(rec.id)}
                    >
                      {accept.isPending ? <span className="spinner" /> : <Check size={13} />} Accept
                    </button>
                    <button
                      className="btn btn-sm btn-secondary"
                      disabled={dismiss.isPending}
                      onClick={() => dismiss.mutate(rec.id)}
                    >
                      <X size={13} /> Dismiss
                    </button>
                  </div>
                ) : (
                  <span className={`badge badge-${rec.status.toLowerCase()}`}>{rec.status}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating chatbot — recommendation context */}
      <AIChatbot
        context={{ page: 'recommendation' }}
        initialMessage="I can explain why these access items are recommended and help you evaluate the risk. Ask me anything!"
      />
    </div>
  );
}
