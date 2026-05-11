import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { certificationApi } from '../../api/certification.api';
import { formatDate } from '../../lib/utils';
import type { CertificationCampaign } from '../../types/certification.types';

export function CertificationListPage() {
  const [search, setSearch] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['certifications', { search }],
    queryFn: () => certificationApi.list({ search } as any),
  });

  const certs = (data?.data ?? []) as CertificationCampaign[];

  const filtered = certs; // Server-side search implemented

  return (
    <div>
      <PageHeader
        title="Certification Campaigns"
        subtitle="Manage access certification campaigns"
        actions={
          <div style={{ display: 'flex', gap: 10 }}>
            <Link to="/admin/certifications/history" className="btn btn-secondary">Campaign History</Link>
            <Link to="/admin/certifications/new" className="btn btn-primary"><Plus size={16} /> New Campaign</Link>
          </div>
        }
      />

      <div className="filters-bar">
        <div className="search-input-wrap">
          <Search size={14} />
          <input 
            className="form-control" 
            placeholder="Search campaigns…" 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
          />
        </div>
      </div>

      {isError ? (
        <div className="error-state">
          <div className="error-state-title">Failed to load certifications</div>
          <button className="btn btn-secondary" onClick={() => refetch()}>Retry</button>
        </div>
      ) : isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 100, borderRadius: 'var(--radius-lg)' }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-title">No campaigns found</div>
          <div className="empty-state-desc">Try adjusting your search</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(cert => {
            const pct = cert.total_items > 0 ? Math.round(((cert.certified_count + cert.revoked_count) / cert.total_items) * 100) : 0;
            return (
              <div key={cert.id} className="card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <span className="font-semibold">{cert.name}</span>
                      <StatusBadge status={cert.status} />
                    </div>
                    <div className="text-xs text-muted" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span>{formatDate(cert.start_date)} — {formatDate(cert.end_date)}</span>
                      {cert.status === 'ACTIVE' && (
                        <span className="badge badge-low" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span className="pulse" style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'currentColor' }} />
                          {(() => {
                            const diff = new Date(cert.end_date).getTime() - Date.now();
                            if (diff <= 0) return 'Deadline Reached';
                            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                            if (days > 0) return `${days}d ${hours}h remaining`;
                            return `${hours}h remaining`;
                          })()}
                        </span>
                      )}
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span className="text-xs text-muted">Progress</span>
                        <span className="text-xs font-semibold">{pct}%</span>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="text-xs text-muted" style={{ marginTop: 4 }}>
                        {cert.certified_count} certified · {cert.revoked_count} revoked · {cert.pending_count} pending
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Link to={`/admin/certifications/${cert.id}`} className="btn btn-secondary btn-sm">
                      View Details
                    </Link>
                    <Link to={`/admin/certifications/${cert.id}/report`} className="btn btn-outline btn-sm">
                      Report
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
