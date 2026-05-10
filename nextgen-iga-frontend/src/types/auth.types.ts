export type UserRole = 'end_user' | 'supervisor' | 'admin';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  status: 'ACTIVE' | 'INACTIVE';
  manager?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

// Actual backend POST /api/user/login response inside data
export interface BackendLoginData {
  token: string;
  userId: string;
  role: string;
}

// Legacy — kept for KC flow compatibility
export interface LoginResponse extends AuthTokens {
  user: User;
}

export interface Session {
  id: string;
  device: string;
  ip_address: string;
  created_at: string;
  last_active: string;
}
