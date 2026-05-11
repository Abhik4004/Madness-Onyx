export type JobStatus = 'QUEUED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

export interface UserAccess {
  id: string;
  user_id: string;
  user_name: string;
  application_id: string;
  application_name: string;
  role_id: string;
  role_name: string;
  granted_at: string;
  expires_at: string | null;
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED' | 'PROVISIONED' | 'PENDING';
}

export interface ProvisioningJob {
  id: string;
  request_id: string;
  user_id: string;
  user_name: string;
  application_id: string;
  application_name: string;
  action: 'GRANT' | 'REVOKE';
  status: JobStatus;
  error_message: string | null;
  retry_count: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}
