import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Sparkles, FileText, RefreshCw, Download, Activity, History as HistoryIcon, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeader } from '../../components/layout/PageHeader';
import { aiApi, type AIReport } from '../../api/ai.api';
import { formatDate, formatDateTime } from '../../lib/utils';
import { AIInsightsWidget, AIAnomaliesWidget, AIHealthStatus } from './AIWidgets';
import { Link } from 'react-router-dom';

import { useAuthStore } from '../../stores/auth.store';

export function AIAuditPage() {
  const [query, setQuery] = useState('');
  const [selectedReport, setSelectedReport] = useState<AIReport | null>(null);
  const { user } = useAuthStore();

  const reportsQuery = useQuery({
    queryKey: ['ai', 'reports'],
    queryFn: () => aiApi.listReports(),
  });

  const generateReport = useMutation({
    mutationFn: (q: string) => aiApi.generateReport(q, user?.id),
    onSuccess: (data) => {
      toast.success('Report generated successfully');
      setSelectedReport(data);
      reportsQuery.refetch();
    },
    onError: () => toast.error('Failed to generate report. AI service might be busy.'),
  });

  const convertToCSV = (data: any[]) => {
    if (!data || data.length === 0) return '';
    const headers = Object.keys(data[0]);
    const headerRow = headers.map(h => `"${h.replace(/"/g, '""')}"`).join(',');
    const rows = data.map(row => 
      headers.map(header => {
        const val = row[header] === null || row[header] === undefined ? '' : row[header];
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(',')
    );
    return [headerRow, ...rows].join('\n');
  };

  const handleDownload = async (id: string, title: string) => {
    const toastId = toast.loading('Preparing CSV download directly from UI...');
    try {
      // 1. Direct UI Download: Use the already loaded selectedReport to avoid ANY API call
      let reportToExport = selectedReport;
      
      if (!reportToExport || reportToExport.id !== id || !reportToExport.detailed_records) {
        reportToExport = await aiApi.getReport(id);
      }
      
      if (!reportToExport || !reportToExport.detailed_records) {
        throw new Error('Report data is not available for CSV conversion');
      }

      // 2. Convert detailed records to CSV
      const csvContent = convertToCSV(reportToExport.detailed_records);
      
      // 3. Create a blob and download locally
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const safeTitle = (title || 'AI_Report').replace(/\s+/g, '_');
      link.setAttribute('download', `${safeTitle}_${id}.csv`);
      
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('CSV Download complete', { id: toastId });
    } catch (err: any) {
      console.error('[ai] csv download error:', err);
      toast.error(err.message || 'Download failed.', { id: toastId });
    }
  };

  const [historySearch, setHistorySearch] = useState('');

  const reportsList = Array.isArray(reportsQuery.data) ? reportsQuery.data : [];

  const filteredHistory = useMemo(() => {
    if (!historySearch) return reportsList;
    const q = historySearch.toLowerCase();
    return reportsList.filter(r => 
      r.title?.toLowerCase().includes(q) || 
      r.type?.toLowerCase().includes(q)
    );
  }, [reportsList, historySearch]);

  return (
    <div>
      <PageHeader
        title="AI Analytics & Reporting"
        subtitle="AI-powered automated reporting and access review history"
      />

      <div style={{ marginTop: 20 }}>
        <div className="grid-12" style={{ gap: 20 }}>
          {/* Left: Report History */}
          <div className="span-4" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="card glass" style={{ border: '1px solid var(--color-primary-light)', height: 'calc(100vh - 250px)', display: 'flex', flexDirection: 'column' }}>
              <div className="card-header">
                <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--color-primary)' }}>
                  <HistoryIcon size={20} /> Insight History
                </span>
                <button className="btn-icon" onClick={() => reportsQuery.refetch()} style={{ color: 'var(--color-primary)' }}><RefreshCw size={16} /></button>
              </div>

              <div style={{ padding: '0 16px 16px' }}>
                <div className="search-input-wrap">
                  <Search size={14} />
                  <input 
                    className="form-control" 
                    placeholder="Search history…" 
                    value={historySearch} 
                    onChange={e => setHistorySearch(e.target.value)} 
                  />
                </div>
              </div>
              
              <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
                {reportsQuery.isLoading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: 64, borderRadius: 12 }} />)}
                  </div>
                ) : filteredHistory.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText size={32} style={{ color: 'var(--color-gray-300)', marginBottom: 12 }} />
                    <p className="text-sm text-muted">No reports found</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {filteredHistory.map(r => (
                      <div 
                        key={r.id} 
                        className={`selectable-item ${selectedReport?.id === r.id ? 'active' : ''}`}
                        style={{ 
                          padding: 16, 
                          borderRadius: 14, 
                          border: '1px solid var(--color-gray-100)',
                          background: selectedReport?.id === r.id ? 'var(--color-primary-light)' : '#fff',
                          transition: 'var(--transition)'
                        }}
                        onClick={async () => {
                          const full = await aiApi.getReport(r.id);
                          setSelectedReport(full);
                        }}
                      >
                        <div className="font-bold text-sm" style={{ color: selectedReport?.id === r.id ? 'var(--color-primary-dark)' : 'var(--color-gray-900)' }}>{r.title}</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, alignItems: 'center' }}>
                          <span className="text-xs text-muted font-medium">{formatDate(r.generated_at)}</span>
                          <span className="badge" style={{ fontSize: '0.65rem', background: 'rgba(0,0,0,0.05)', color: 'var(--color-gray-600)' }}>{r.type}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Generator & Viewer */}
          <div className="span-8">
            <div className="card glass" style={{ marginBottom: 24, background: 'var(--grad-surface)', border: '1px solid var(--color-primary-light)' }}>
              <div className="card-header">
                <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--color-primary)' }}>
                  <Sparkles size={20} /> AI Report Engine
                </span>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <input 
                  className="form-control" 
                  style={{ flex: 1, height: 48, borderRadius: 12, border: '1px solid var(--color-primary-light)', padding: '0 20px', fontSize: '1rem', background: '#fff' }}
                  placeholder="Ask AI to generate a custom audit report (e.g. 'Show me all privilege escalations in SAP last week')"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                />
                <button 
                  className="btn btn-primary"
                  style={{ height: 48, padding: '0 24px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)' }}
                  disabled={!query.trim() || generateReport.isPending}
                  onClick={() => generateReport.mutate(query)}
                >
                  {generateReport.isPending ? <span className="spinner" /> : <Search size={18} />}
                  Run Analysis
                </button>
              </div>
            </div>

            {selectedReport ? (
              <div className="card fade-in">
                <div className="card-header">
                  <div>
                    <div className="card-title">{selectedReport.title}</div>
                    <div className="text-sm text-muted">{selectedReport.header}</div>
                  </div>
                  <button className="btn btn-secondary" onClick={() => handleDownload(selectedReport.id, selectedReport.title)}>
                    <Download size={16} /> Download CSV
                  </button>
                </div>

                <div className="report-content" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  <div>
                    <div className="text-xs font-bold text-muted uppercase mb-2">Executive Summary</div>
                    <p className="text-sm leading-relaxed">{selectedReport.summary}</p>
                  </div>

                  <div className="grid-2" style={{ gap: 20 }}>
                    <div>
                      <div className="text-xs font-bold text-muted uppercase mb-2">Key Findings</div>
                      <ul style={{ paddingLeft: 16 }}>
                        {(selectedReport.findings ?? []).map((f, i) => (
                          <li key={i} className="text-sm mb-2">{f}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-muted uppercase mb-2">Recommendations</div>
                      <ul style={{ paddingLeft: 16 }}>
                        {(selectedReport.recommendations ?? []).map((r, i) => (
                          <li key={i} className="text-sm mb-2" style={{ color: 'var(--color-primary)' }}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {(selectedReport.risk_sections ?? []).length > 0 && (
                    <div>
                      <div className="text-xs font-bold text-muted uppercase mb-2">Risk Assessment</div>
                      <div className="grid-2" style={{ gap: 12 }}>
                        {(selectedReport.risk_sections ?? []).map((section, i) => (
                          <div key={i} className="alert alert-info" style={{ marginBottom: 0 }}>
                            <div className="font-bold text-xs">{section.label}</div>
                            <div className="text-sm">{section.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(selectedReport.detailed_records ?? []).length > 0 && (
                    <div>
                      <div className="text-xs font-bold text-muted uppercase mb-2">Detailed Evidence</div>
                      <div className="table-wrapper">
                        <table className="table-sm">
                          <thead>
                            <tr>
                              {Object.keys(selectedReport.detailed_records[0] || {}).map(k => <th key={k}>{(k || '').replace(/_/g, ' ')}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            {(selectedReport.detailed_records ?? []).map((row, i) => (
                              <tr key={i}>
                                {row && Object.values(row).map((v: any, j) => <td key={j}>{String(v)}</td>)}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className="text-xs text-muted text-right italic">
                    Generated on {formatDateTime(selectedReport.generated_at)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty-state card">
                <FileText size={40} className="text-muted" style={{ marginBottom: 16 }} />
                <div className="empty-state-title">No report selected</div>
                <div className="empty-state-desc">Select a report from the history or generate a new one using the search bar above.</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
