import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, History as HistoryIcon, CheckCircle, XCircle, Clock } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { certificationApi } from '../../api/certification.api';
import { formatDate } from '../../lib/utils';
import { usePermissions } from '../../hooks/usePermissions';

export function CertificationHistoryPage() {
  const { isAdmin, isSupervisor } = usePermissions();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['certifications', 'history'],
    queryFn: () => certificationApi.getHistory(),
  });

  const history = data?.data ?? [];

  return (
    <div>
      <PageHeader
        title="Campaign History"
        subtitle="Track and audit past certification campaigns"
        actions={
          isAdmin ? (
            <div style={{ display: 'flex', gap: 10 }}>
              <Link to="/admin/certifications" className="btn btn-secondary">Active Campaigns</Link>
              <Link to="/admin/certifications/new" className="btn btn-primary"><Plus size={16} /> New Campaign</Link>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10 }}>
              <Link to="/supervisor/certifications/my-tasks" className="btn btn-primary">Go to My Tasks</Link>
            </div>
          )
        }
      />

      {isError ? (
        <div className="error-state">
          <div className="error-state-title">Failed to load campaign history</div>
          <button className="btn btn-secondary" onClick={() => refetch()}>Retry</button>
        </div>
      ) : isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 120, borderRadius: 'var(--radius-lg)' }} />)}
        </div>
      ) : history.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-title">No campaign history found</div>
          <div className="empty-state-desc">History will appear here once campaigns are created and processed.</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Campaign Name</th>
                <th>Status</th>
                <th>Created By</th>
                <th>Scope</th>
                <th>Stats (U/A)</th>
                <th>Progress</th>
                <th>Created At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item: any) => {
                const total = item.total_accesses || 1;
                const completed = item.certified_count + item.revoked_count;
                const pct = Math.round((completed / total) * 100);

                return (
                  <tr key={item.id}>
                    <td>
                      <div className="font-semibold">{item.campaign_name}</div>
                      <div className="text-xs text-muted">{item.campaign_id.split('-')[0]}...</div>
                    </td>
                    <td><StatusBadge status={item.status} /></td>
                    <td><span className="text-xs font-mono">{item.created_by}</span></td>
                    <td><span className="text-xs">{item.hierarchy_scope}</span></td>
                    <td>
                      <div className="text-xs">
                        <strong>{item.total_users}</strong> users / <strong>{item.total_accesses}</strong> accesses
                      </div>
                    </td>
                    <td>
                      <div style={{ width: 100 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                          <span className="text-xs text-muted">{pct}%</span>
                        </div>
                        <div className="progress-bar" style={{ height: 4 }}>
                          <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                        </div>
                        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                           <span className="text-xs text-success" title="Certified"><CheckCircle size={10}/> {item.certified_count}</span>
                           <span className="text-xs text-danger" title="Revoked"><XCircle size={10}/> {item.revoked_count}</span>
                           <span className="text-xs text-warning" title="Pending"><Clock size={10}/> {item.pending_count}</span>
                        </div>
                      </div>
                    </td>
                    <td className="text-xs text-muted">{formatDate(item.created_at)}</td>
                    <td>
                      <Link 
                        to={isAdmin ? `/admin/certifications/${item.campaign_id}` : `/supervisor/certifications/my-tasks/${item.campaign_id}`} 
                        className="btn btn-secondary btn-sm"
                      >
                        Details
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
