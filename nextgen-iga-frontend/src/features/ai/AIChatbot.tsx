import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Send, Minimize2, Bot, User, Sparkles, Download, AlertTriangle } from 'lucide-react';
import { aiApi, type AIChatMessage } from '../../api/ai.api';
import { formatRelative, formatDate } from '../../lib/utils';
import { routeAIRequest } from './aiRouter';
import toast from 'react-hot-toast';

interface Props {
  context?: { page: string };
  initialMessage?: string;
}

const QUICK_PROMPTS: Record<string, string[]> = {
  recommendation: ['Why is this access recommended?', 'What are the risk factors?', 'Show peer comparison'],
  certification: ['Summarise pending items', 'Which items should I revoke?', 'Explain high-risk access'],
  audit: ['Any anomalies this week?', 'Top risk users?', 'Compliance score summary'],
  general: ['How do I request access?', 'What is my current risk score?', 'Show my pending approvals'],
};

import { useUIStore } from '../../stores/ui.store';
import { useAuthStore } from '../../stores/auth.store';

export function AIChatbot({ context, initialMessage }: Props) {
  const { 
    aiChatOpen: open, 
    setAiChatOpen: setOpen, 
    aiChatMinimised: minimised, 
    setAiChatMinimised: setMinimised,
    aiMessages: messages,
    setAiMessages: setMessages,
    addAiMessage
  } = useUIStore();
  
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { user } = useAuthStore();

  const contextKey = context?.page ?? 'general';
  const quickPrompts = QUICK_PROMPTS[contextKey] ?? QUICK_PROMPTS.general;

  useEffect(() => {
    if (open && !minimised) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      inputRef.current?.focus();
      setHasUnread(false);
    }
  }, [open, minimised, messages]);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        id: 'greeting',
        role: 'assistant',
        content: initialMessage ?? `Hi! I'm your IGA AI assistant. How can I help you with ${contextKey} tasks?`,
        timestamp: new Date().toISOString(),
      }]);
    }
  }, [open, messages.length, contextKey, initialMessage]);

  const handleDownload = async (id: string, title: string) => {
    try {
      const blob = await aiApi.downloadReport(id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${title.replace(/\s+/g, '_')}_${id}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Download failed');
    }
  };

  const send = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: AIChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toISOString(),
    };
    addAiMessage(userMsg);
    setInput('');
    setLoading(true);

    try {
      const routed = await routeAIRequest(text.trim(), messages, user?.id);
      
      const aiMsg: AIChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: routed.text || '',
        phase: routed.phase,
        data: routed.data,
        response_text: routed.phase === 'CHAT' ? routed.data.response_text : routed.text,
        data_table: routed.phase === 'CHAT' ? routed.data.data_table : undefined,
        suggestions: routed.phase === 'CHAT' ? routed.data.suggestions : undefined,
        timestamp: new Date().toISOString(),
      };
      addAiMessage(aiMsg);
      if (minimised) setHasUnread(true);
    } catch {
      addAiMessage({
        id: `e-${Date.now()}`,
        role: 'assistant',
        content: 'AI service unavailable. Please try again later.',
        timestamp: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  }, [loading, messages, minimised, user, addAiMessage]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const renderDataContent = (msg: AIChatMessage) => {
    if (!msg.data && !msg.data_table) return null;

    if (msg.phase === 'REPORT_GENERATION' && msg.data) {
      return (
        <div style={{ marginTop: 8, padding: 8, background: 'white', borderRadius: 6, border: '1px solid var(--color-gray-200)' }}>
          <div style={{ fontWeight: 600, fontSize: '0.7rem' }}>{msg.data.title}</div>
          <button className="btn btn-xs btn-secondary" style={{ marginTop: 4, width: '100%' }} onClick={() => handleDownload(msg.data.id, msg.data.title)}>
            <Download size={10} /> Download JSON
          </button>
        </div>
      );
    }

    if (msg.phase === 'ANOMALY_ANALYSIS' && Array.isArray(msg.data)) {
      return (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {msg.data.slice(0, 2).map((a: any) => (
            <div key={a.id} style={{ fontSize: '0.65rem', padding: 4, background: 'var(--color-danger-lightest)', borderRadius: 4 }}>
              <AlertTriangle size={10} color="var(--color-danger)" style={{ marginRight: 4 }} />
              {a.description.slice(0, 50)}...
            </div>
          ))}
        </div>
      );
    }

    return null;
  };

  return (
    <>
      {!open && (
        <button className="ai-fab" onClick={() => setOpen(true)} aria-label="Open AI Assistant">
          <Sparkles size={20} />
          {hasUnread && <span className="ai-fab-dot" />}
        </button>
      )}

      {open && (
        <div className={`ai-chat-panel ${minimised ? 'minimised' : ''}`}>
          <div className="ai-chat-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="ai-chat-avatar"><Bot size={16} /></div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>IGA Assistant</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-gray-400)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span className="ai-online-dot" /> AI-powered
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="btn-icon" style={{ color: 'var(--color-gray-300)' }} onClick={() => setMinimised(!minimised)}>
                <Minimize2 size={15} />
              </button>
              <button className="btn-icon" style={{ color: 'var(--color-gray-300)' }} onClick={() => { setOpen(false); setMinimised(false); }}>
                <X size={15} />
              </button>
            </div>
          </div>

          {!minimised && (
            <>
              <div className="ai-chat-messages">
                {messages.map(msg => (
                  <div key={msg.id} className={`ai-msg ai-msg-${msg.role}`}>
                    {msg.role === 'assistant' && <div className="ai-msg-avatar"><Bot size={13} /></div>}
                    <div className="ai-msg-bubble">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: msg.phase ? 2 : 0 }}>
                        {msg.phase && <span className="badge" style={{ fontSize: '0.5rem', padding: '1px 4px' }}>{msg.phase}</span>}
                      </div>
                      <div className="ai-msg-text">{msg.content}</div>
                      {renderDataContent(msg)}
                      <div className="ai-msg-time">{formatRelative(msg.timestamp)}</div>
                    </div>
                    {msg.role === 'user' && <div className="ai-msg-avatar ai-msg-avatar-user"><User size={13} /></div>}
                  </div>
                ))}
                {loading && (
                  <div className="ai-msg ai-msg-assistant">
                    <div className="ai-msg-avatar"><Bot size={13} /></div>
                    <div className="ai-msg-bubble"><div className="ai-typing"><span /><span /><span /></div></div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {messages.length <= 1 && (
                <div className="ai-quick-prompts">
                  {quickPrompts.map(p => (
                    <button key={p} className="ai-quick-chip" onClick={() => send(p)}>{p}</button>
                  ))}
                </div>
              )}

              <div className="ai-chat-input-row">
                <textarea
                  ref={inputRef}
                  className="ai-chat-input"
                  placeholder="Ask anything…"
                  rows={1}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                />
                <button className="ai-send-btn" disabled={!input.trim() || loading} onClick={() => send(input)}>
                  <Send size={15} />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
