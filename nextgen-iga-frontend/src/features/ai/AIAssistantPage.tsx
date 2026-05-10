import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User, Sparkles, Table, MessageSquare, AlertCircle, Download, FileText, Activity, AlertTriangle } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { aiApi, type AIChatMessage } from '../../api/ai.api';
import { routeAIRequest } from './aiRouter';
import { formatDate, formatDateTime, formatRelative } from '../../lib/utils';
import toast from 'react-hot-toast';

import { useAuthStore } from '../../stores/auth.store';

export function AIAssistantPage() {
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { user } = useAuthStore();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    inputRef.current?.focus();
  }, [messages, loading]);

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: '1',
          role: 'assistant',
          content: 'Hello! I am your AI IGA Assistant. How can I help you today with access governance, compliance reports, or anomaly detection?',
          timestamp: new Date().toISOString(),
        },
      ]);
    }
  }, []);

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

  const handleDownload = async (id: string, title: string, directData?: any[]) => {
    const toastId = toast.loading('Preparing CSV download directly from UI...');
    try {
      let dataToConvert = directData;
      
      if (!dataToConvert) {
        const report = await aiApi.getReport(id);
        dataToConvert = report.detailed_records || (Array.isArray(report) ? report : []);
      }
      
      if (!dataToConvert || (Array.isArray(dataToConvert) && dataToConvert.length === 0)) {
        throw new Error('No data available for CSV conversion');
      }

      const csvContent = convertToCSV(dataToConvert);
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
      console.error('[ai] assistant csv download error:', err);
      toast.error(err.message || 'Download failed.', { id: toastId });
    }
  };

  const send = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: AIChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const routed = await routeAIRequest(text.trim(), messages, user?.id);

      const assistantMsg: AIChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: routed.text || '',
        phase: routed.phase,
        data: routed.data,
        response_text: routed.phase === 'CHAT' ? routed.data.response_text : routed.text,
        data_table: routed.phase === 'CHAT' ? routed.data.data_table : undefined,
        suggestions: routed.phase === 'CHAT' ? routed.data.suggestions : undefined,
        timestamp: new Date().toISOString(),
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (error) {
      toast.error('AI Service encountered an error');
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 2).toString(),
          role: 'assistant',
          content: 'I apologize, but I am currently unable to process your request. Please try again later.',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [loading, messages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const renderTable = (data: any[]) => {
    if (!data || data.length === 0) return null;
    const keys = Object.keys(data[0]);
    return (
      <div style={{ overflowX: 'auto', marginTop: 12 }}>
        <table className="table-sm" style={{ minWidth: 400, background: 'white', fontSize: '0.75rem' }}>
          <thead>
            <tr>{keys.map(k => <th key={k}>{k.replace(/_/g, ' ').toUpperCase()}</th>)}</tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i}>{keys.map(k => <td key={k}>{String(row[k])}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderDataContent = (msg: AIChatMessage) => {
    if (!msg.data && !msg.data_table) return null;

    if (msg.phase === 'CHAT' && msg.data_table && msg.data_table.length > 0) {
      return renderTable(msg.data_table);
    }

    if (msg.phase === 'REPORT_GENERATION' && msg.data) {
      const r = msg.data;
      return (
        <div className="card" style={{ marginTop: 12, border: '1px solid var(--color-primary-light)', background: 'white' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <div className="font-bold text-sm" style={{ color: 'var(--color-primary)' }}>{r.title}</div>
              <div className="text-xs text-muted">{r.type} · {formatDate(r.generated_at)}</div>
            </div>
            <button className="btn btn-sm btn-secondary" onClick={() => handleDownload(r.id, r.title, r.detailed_records)}><Download size={14} /> CSV</button>
          </div>
          <div className="text-xs" style={{ lineHeight: 1.6 }}>{r.summary?.slice(0, 200)}...</div>
        </div>
      );
    }

    // 3. REPORT_HISTORY
    if (msg.phase === 'REPORT_HISTORY' && Array.isArray(msg.data)) {
      return (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(msg.data ?? []).slice(0, 5).map((r: any) => (
            <div key={r.id} className="selectable-item" style={{ background: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px' }}>
              <div>
                <div className="font-medium text-xs">{r.title}</div>
                <div className="text-xs text-muted">{formatDate(r.generated_at)}</div>
              </div>
              <button className="btn-icon" onClick={() => handleDownload(r.id, r.title)} title="Download CSV"><Download size={14} /></button>
            </div>
          ))}
        </div>
      );
    }

    // 4. INSIGHT_ANALYSIS
    if (msg.phase === 'INSIGHT_ANALYSIS' && Array.isArray(msg.data)) {
      return (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(msg.data ?? []).slice(0, 3).map((insight: any) => (
            <div key={insight.id} style={{ padding: 10, background: 'var(--color-gray-50)', borderRadius: 8, borderLeft: `3px solid var(--color-${insight.severity?.toLowerCase() || 'info'})` }}>
              <div className="font-bold text-xs" style={{ marginBottom: 4 }}>{insight.description}</div>
              <div className="text-xs text-muted">Rec: {insight.recommendation}</div>
            </div>
          ))}
        </div>
      );
    }

    // 5. ANOMALY_ANALYSIS
    if (msg.phase === 'ANOMALY_ANALYSIS' && Array.isArray(msg.data)) {
      return (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(msg.data ?? []).slice(0, 3).map((anomaly: any) => (
            <div key={anomaly.id} style={{ padding: 10, background: 'var(--color-danger-lightest)', borderRadius: 8, border: '1px solid var(--color-danger-light)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <AlertTriangle size={12} color="var(--color-danger)" />
                <span className="font-bold text-xs text-danger">{anomaly.severity}</span>
              </div>
              <div className="text-xs font-medium">{anomaly.description}</div>
            </div>
          ))}
        </div>
      );
    }

    // 6. AUDIT_ANALYSIS
    if (msg.phase === 'AUDIT_ANALYSIS' && Array.isArray(msg.data)) {
      return <div style={{ marginTop: 12 }}>{renderTable((msg.data ?? []).slice(0, 5))}</div>;
    }

    return null;
  };

  return (
    <div className="fade-in" style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
      <PageHeader 
        title="AI Assistant" 
        subtitle="Natural language interface for governance and analytics"
      />

      <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {messages.map(msg => (
            <div key={msg.id} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{ display: 'flex', gap: 12, maxWidth: '85%', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: msg.role === 'user' ? 'var(--color-primary)' : 'var(--color-gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: msg.role === 'user' ? 'white' : 'var(--color-primary)' }}>
                  {msg.role === 'user' ? <User size={18} /> : <Bot size={18} />}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{ padding: '12px 16px', borderRadius: 12, background: msg.role === 'user' ? 'var(--color-primary-light)' : 'var(--color-gray-50)', color: 'var(--color-gray-900)', fontSize: '0.95rem', lineHeight: 1.5, boxShadow: 'var(--shadow-sm)', border: '1px solid var(--color-gray-200)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: msg.phase ? 4 : 0 }}>
                      {msg.phase && <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>{msg.phase.replace('_', ' ')}</span>}
                    </div>
                    {msg.content}
                    {renderDataContent(msg)}
                  </div>
                  {(msg.suggestions ?? []).length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {(msg.suggestions ?? []).map(s => (
                        <button key={s} className="btn btn-sm btn-secondary" style={{ borderRadius: 20, fontSize: '0.75rem', padding: '4px 12px' }} onClick={() => send(s)}>{s}</button>
                      ))}
                    </div>
                  )}
                  <div className="text-xs text-muted">{formatRelative(msg.timestamp)}</div>
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--color-gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)' }}>
                <Bot size={18} />
              </div>
              <div className="ai-typing" style={{ marginTop: 12 }}><span /><span /><span /></div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div style={{ padding: '20px', borderTop: '1px solid var(--color-gray-100)', background: 'var(--color-gray-50)' }}>
          <div style={{ position: 'relative' }}>
            <textarea
              ref={inputRef}
              className="form-control"
              placeholder="Type your question about access, compliance, or reports..."
              style={{ minHeight: 60, paddingRight: 50, borderRadius: 12, resize: 'none' }}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button className="btn btn-primary" style={{ position: 'absolute', right: 10, bottom: 10, borderRadius: 8, width: 36, height: 36, padding: 0 }} disabled={!input.trim() || loading} onClick={() => send(input)}>
              <Send size={18} />
            </button>
          </div>
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--color-gray-500)' }}>
            <Sparkles size={12} color="var(--color-primary)" />
            Press Enter to send, Shift+Enter for new line.
          </div>
        </div>
      </div>
    </div>
  );
}
