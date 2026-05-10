// Actual backend response envelope
// Auth routes: { status, message, data }
// Async routes: { ok, status: 202, message, requestId, data? }
// Sync routes:  { ok, status: 200, data }
// Errors:       { ok: false, status, message }

export interface ApiResponse<T = unknown> {
  ok?: boolean;
  status: number;
  message?: string;
  data?: T;
  requestId?: string; // top-level on 202 async responses
  meta?: PaginationMeta;
}

// Paginated audit log response wraps logs inside data
export interface AuditLogPage {
  logs: AuditLogEntry[];
  total: number;
}

export interface AuditLogEntry {
  id: number;
  event_type: string;
  actor_id: string;
  actor_name: string;
  target_id: string | null;
  details: any;
  created_at: string;
}

// Legacy shape kept for components not yet updated
export interface PaginationMeta {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export interface ApiError {
  field: string;
  message: string;
}
