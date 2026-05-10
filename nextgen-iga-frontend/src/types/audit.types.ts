export interface AuditLog {
  id: string;
  event_type: string;
  actor_id: string;
  actor_name: string;
  target_id: string | null;
  target_type: string | null;
  description: string;
  payload: Record<string, unknown>;
  ip_address: string;
  created_at: string;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  user_count: number;
  created_at: string;
}

export interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
}

export interface Recommendation {
  id: string;
  user_id: string;
  application_id: string;
  application_name: string;
  role_id: string;
  role_name: string;
  reason: string;
  confidence_score: number;
  status: 'PENDING' | 'ACCEPTED' | 'DISMISSED';
  created_at: string;
}

export interface RiskProfile {
  user_id: string;
  user_name: string;
  overall_score: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  factors: RiskFactor[];
  last_updated: string;
}

export interface RiskFactor {
  name: string;
  score: number;
  description: string;
}
