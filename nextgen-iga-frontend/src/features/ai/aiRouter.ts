import { aiApi, type AIChatResponse, type AIInsight, type AIAnomaly, type AIReport, type AIReportHistoryItem, type AIAuditLog } from '../../api/ai.api';

export type AIRequestPhase = 
  | 'CHAT' 
  | 'REPORT_GENERATION' 
  | 'REPORT_HISTORY' 
  | 'INSIGHT_ANALYSIS' 
  | 'ANOMALY_ANALYSIS' 
  | 'AUDIT_ANALYSIS';

export interface AIRoutedResponse {
  phase: AIRequestPhase;
  data: any;
  text?: string;
}

export const routeAIRequest = async (query: string, history: any[], userId?: string): Promise<AIRoutedResponse> => {
  const q = query.toLowerCase();

  // 1. Report Generation
  if (
    q.includes('generate report') || 
    q.includes('export report') || 
    q.includes('privileged access report') || 
    q.includes('audit report') || 
    q.includes('compliance report') || 
    q.includes('access review report')
  ) {
    const data = await aiApi.generateReport(query, userId);
    return { phase: 'REPORT_GENERATION', data, text: `I have generated the ${data.title}. You can view the summary below and download the full JSON.` };
  }

  // 2. Report History
  if (
    q.includes('show reports') || 
    q.includes('report history') || 
    q.includes('previous reports') || 
    q.includes('generated reports')
  ) {
    const data = await aiApi.listReports();
    return { phase: 'REPORT_HISTORY', data, text: 'Here are the recently generated reports:' };
  }

  // 3. Insights
  if (
    q.includes('insights') || 
    q.includes('trends') || 
    q.includes('approval spikes') || 
    q.includes('analytics') || 
    q.includes('dashboard insights')
  ) {
    const data = await aiApi.getInsights();
    return { phase: 'INSIGHT_ANALYSIS', data, text: 'Based on our analysis, here are the latest governance insights:' };
  }

  // 4. Anomalies
  if (
    q.includes('anomalies') || 
    q.includes('suspicious activity') || 
    q.includes('unusual approvals') || 
    q.includes('outliers') || 
    q.includes('abnormal access patterns')
  ) {
    const data = await aiApi.getAnomalies();
    return { phase: 'ANOMALY_ANALYSIS', data, text: 'I have detected the following suspicious activities that may require attention:' };
  }

  // 5. Audit Logs
  if (
    q.includes('audit logs') || 
    q.includes('user activity') || 
    q.includes('approval logs') || 
    q.includes('access history') || 
    q.includes('actor activity')
  ) {
    const data = await aiApi.getAuditLogs();
    return { phase: 'AUDIT_ANALYSIS', data, text: 'Here are the latest system audit logs:' };
  }

  // 6. Default: Chat
  const data = await aiApi.chat({ message: query, history });
  return { phase: 'CHAT', data, text: data.response_text };
};
