export type RequestStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'PROVISIONED'
  | 'EXPIRED';

export interface AccessRequest {
  id: string;
  user_id: string;
  user_name: string;
  target_user_id: string | null;
  target_user_name: string | null;
  application_id: string;
  application_name: string;
  role_id: string;
  role_name: string;
  justification: string;
  duration_days: number | null;
  status: RequestStatus;
  approver_id: string | null;
  approver_name: string | null;
  approver_comment: string | null;
  rejection_reason: string | null;
  submitted_at: string;
  decided_at: string | null;
  provisioned_at: string | null;
  expires_at: string | null;
  approved_at: string | null;
  history: RequestHistoryEntry[];
  duration_seconds?: number | null;
}

export interface RequestHistoryEntry {
  id: string;
  event: string;
  actor_name: string;
  comment: string | null;
  timestamp: string;
}

export interface Application {
  id: string;
  name: string;
  description: string;
  category: string;
  owner_id: string;
  owner_name: string;
  icon_url: string | null;
  connector_status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
  access_count: number;
  risk_level?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  risk_score?: number;
  created_at: string;
}

export interface AppRole {
  id: string;
  name: string;
  description: string;
  application_id: string;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
}
