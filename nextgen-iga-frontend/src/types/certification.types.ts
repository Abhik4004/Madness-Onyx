export type CertificationStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type DecisionStatus = 'PENDING' | 'CERTIFIED' | 'REVOKED';

export interface Certification {
  id: string;
  name: string;
  status: CertificationStatus;
  start_date: string;
  end_date: string;
  created_by: string;
  total_items: number;
  certified_count: number;
  revoked_count: number;
  pending_count: number;
  created_at: string;
}

export interface CertificationItem {
  id: string;
  certification_id: string;
  user_id: string;
  user_name: string;
  application_id: string;
  application_name: string;
  role_id: string;
  role_name: string;
  reviewer_id: string;
  reviewer_name: string;
  decision: DecisionStatus;
  comment: string | null;
  decided_at: string | null;
  recommendation_score: number | null;
  recommended_action: 'RETAIN' | 'REVIEW' | null;
  risk_score: number | null;
}

// Alias kept for backward compatibility
export type CertificationCampaign = Certification;

export interface CertificationReport {
  certification_id: string;
  name: string;
  total_items: number;
  certified_count: number;
  revoked_count: number;
  pending_count: number;
  completion_rate: number;
  generated_at: string;
}
