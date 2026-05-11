import { aiClient } from "../lib/axios";
import type { ApiResponse } from "../types/api.types";

// ── CSV Provision Types (re-exported for CsvProvisionPage) ───────────────────
export interface CsvProvisionRow {
  full_name: string;
  email: string;
  role: string;
  department?: string;
  manager?: string;
  [key: string]: string | undefined;
}

export interface CsvRowError {
  row: number;
  field?: string;
  message: string;
}

export interface CsvProvisionPreview {
  total_rows: number;
  valid_rows: number;
  error_rows: number;
  errors: CsvRowError[];
  preview: CsvProvisionRow[];
}

// ── AI Assistant Chat ───────────────────────────────────────────────────────

export interface AIChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  phase?: "CHAT" | "REPORT_GENERATION" | "REPORT_HISTORY" | "INSIGHT_ANALYSIS" | "ANOMALY_ANALYSIS" | "AUDIT_ANALYSIS";
  data?: any;
  response_text?: string;
  data_table?: Record<string, any>[];
  suggestions?: string[];
  timestamp: string;
}

export interface AIChatRequest {
  message: string;
  history?: AIChatMessage[];
  user_id?: string;
}

export interface AIChatResponse {
  response_text: string;
  data_table?: Record<string, any>[];
  suggestions?: string[];
  timestamp: string;
}

// ── AI Insights & Anomalies ──────────────────────────────────────────────────

export interface AIInsight {
  id: string;
  category: string;
  description: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  recommendation: string;
  affected_entities?: string[];
  timestamp: string;
}

export interface AIAnomaly {
  id: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  description: string;
  affected_entities: string[];
  recommendations: string[];
  categories: string[];
  timestamp: string;
}

// ── AI Reports ──────────────────────────────────────────────────────────────

export interface AIReport {
  id: string;
  title: string;
  type: string;
  header: string;
  summary: string;
  findings: string[];
  recommendations: string[];
  detailed_records: Record<string, any>[];
  risk_sections: Record<string, any>[];
  generated_at: string;
  download_url?: string;
}

export interface AIReportHistoryItem {
  id: string;
  title: string;
  type: string;
  generated_at: string;
}

// ── Audit Logs ──────────────────────────────────────────────────────────────

export interface AIAuditLog {
  id: string;
  actor: string;
  actor_id: string;
  event: string;
  event_type: string;
  target_id: string;
  details: string;
  timestamp: string;
}

// ── Health Status ───────────────────────────────────────────────────────────

export interface AIHealthStatus {
  status: "healthy" | "unhealthy";
  api_connected: boolean;
  db_connected: boolean;
  llm_connected: boolean;
}

// ── API Functions ─────────────────────────────────────────────────────────────

export const aiApi = {
  // Chat Assistant
  chat: (body: AIChatRequest, userId?: string): Promise<AIChatResponse> =>
    aiClient
      .post<any>("assistant/chat", { ...body, user_id: userId })
      .then((r) => r.data.data || r.data),

  // Insights & Anomalies
  getInsights: (): Promise<AIInsight[]> =>
    aiClient.get<any>("insights").then((r) => r.data.data || r.data),

  getAnomalies: (): Promise<AIAnomaly[]> =>
    aiClient.get<any>("anomalies").then((r) => r.data.data || r.data),

  // Reports
  generateReport: (query: string, userId?: string): Promise<AIReport> =>
    aiClient
      .post<any>("reports/generate", { query, user_id: userId })
      .then((r) => {
        const raw = r.data.data || r.data;
        // Map report_id to id if backend uses report_id
        const report = raw.report || raw;
        return {
          ...report,
          id: raw.report_id || raw.id || report.id
        };
      }),

  listReports: (): Promise<AIReportHistoryItem[]> =>
    aiClient.get<any>("reports").then((r) => {
      const data = r.data.reports || r.data.data || r.data;
      return (Array.isArray(data) ? data : []).map((item: any) => ({
        ...item,
        id: item.report_id || item.id
      }));
    }),

  getReport: (id: string): Promise<AIReport> =>
    aiClient.get<any>(`reports/${id}`).then((r) => {
      const raw = r.data.data || r.data;
      const report = raw.report || raw;
      return {
        ...report,
        id: raw.report_id || raw.id || report.id
      };
    }),

  downloadReport: (id: string): Promise<Blob> =>
    aiClient
      .get(`reports/${id}/download`, { responseType: "blob" })
      .then((r) => r.data), // Blobs are usually direct

  // Audit Logs
  getAuditLogs: (params?: {
    actor_id?: string;
    event_type?: string;
    target_id?: string;
    from?: string;
    to?: string;
  }): Promise<AIAuditLog[]> =>
    aiClient
      .get<any>("audit/logs", { params })
      .then((r) => r.data.data || r.data),

  // Health Check
  getHealth: (): Promise<AIHealthStatus> =>
    aiClient.get<any>("health").then((r) => r.data.data || r.data),

  // Recommendation Insight for a user
  getRecommendationInsight: (userId: string): Promise<{ summary: string; peer_comparison: string; risk_flags: string[] } | null> =>
    aiClient
      .get<any>(`insights/recommendation/${userId}`)
      .then((r) => r.data.data || r.data)
      .catch(() => null),
};
