import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Download } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { certificationApi } from '../../api/certification.api';
import { formatDate, formatDateTime } from '../../lib/utils';

export function CampaignReportPage() {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['certReport', id],
    queryFn: () => certificationApi.getReport(id!),
    enabled: !!id,
  });

  const report = data?.data;

  if (isLoading) return <div className="card"><div className="skeleton" style={{ height: 300 }} /></div>;
  if (isError || !report) return (
    <div className="error-state">
      <AlertTriangle size={32} className="error-state-icon" />
      <div className="error-state-title">Report not available</div>
      <Link to="/admin/certifications" className="btn btn-secondary">← Back</Link>
    </div>
  );

  const pct = report.total_items > 0 ? Math.round(((report.certified_count + report.revoked_count) / report.total_items) * 100) : 0;

  return (
    <div>
      <PageHeader
        title={`Report — ${report.name}`}
        breadcrumbs={[{ label: 'Certifications', to: '/admin/certifications' }, { label: report.name }]}
        actions={
          <button className="btn btn-primary" onClick={() => window.print()}>
            <Download size={14} /> Export
          </button>
        }
      />

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Total Items</div>
          <div className="kpi-value">{report.total_items}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Certified</div>
          <div className="kpi-value" style={{ color: 'var(--color-success)' }}>{report.certified_count}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Revoked</div>
          <div className="kpi-value" style={{ color: 'var(--color-danger)' }}>{report.revoked_count}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Completion Rate</div>
          <div className="kpi-value">{pct}%</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">Completion Progress</span></div>
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span className="text-sm">Overall completion</span>
            <span className="text-sm font-bold">{pct}%</span>
          </div>
          <div className="progress-bar" style={{ height: 14 }}>
            <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="text-xs text-muted" style={{ marginTop: 16 }}>Generated at: {formatDateTime(report.generated_at)}</div>
      </div>
    </div>
  );
}
