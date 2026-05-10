import { apiClient, authClient } from "../lib/axios";
import type { ApiResponse } from "../types/api.types";
import type { User, BackendLoginData, Session } from "../types/auth.types";



export const authApi = {
  // Primary Authentication (Hits external LDAP server directly)

  loginPrimary: (body: { uid: string; password: string }) =>
    authClient
      .post<{
        statusCode: number;
        message: string;
        mfaEnabled: boolean;
        userType: string;
        uid: string;
        tokens?: { jwtToken: string; refreshToken: string };
      }>("/api/login", body)
      .then((r) => r.data),

  // MFA Registration
  setupMfa: (body: { uid: string }, token?: string) =>
    authClient
      .post<{
        statusCode: number;
        message: string;
        mfaEnabled: boolean;
        data?: { secret: string; qrCodeUrl: string; setupCode: string };
      }>("/api/mfa/setup", body, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      .then((r) => r.data),

  // MFA Validation
  verifyMfa: (body: { uid: string; code: string }, token: string) =>
    authClient
      .post<{
        statusCode: number;
        message: string;
        mfaEnabled: boolean;
        userType: string;
        tokens?: { jwtToken: string; refreshToken: string };
      }>("/api/mfa/verify", { ...body, token: `Bearer ${token}` }, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((r) => r.data),



  // Legacy login endpoint
  login: (body: { email: string; password: string }) =>
    apiClient
      .post<ApiResponse<BackendLoginData>>("/api/user/login", body)
      .then((r) => r.data),

  // Direct Provisioning Registration (Hits direct IP)
  provisionUser: (body: {
    uid: string;
    givenName: string;
    sn: string;
    cn: string;
    mail: string;
    password: string;
  }) =>
    apiClient
      .post<{ statusCode: number; message: string }>("/api/provision/users", {
        users: [body],
      })
      .then((r) => r.data),

  // Registration — creates user in LDAP + governance DB
  register: (body: {
    email: string;
    password: string;
    full_name: string;
    role?: string;
    userId?: string;
    givenName?: string;
    sn?: string;
  }) =>
    apiClient
      .post<ApiResponse<{ userId: string; email: string; role: string }>>(
        "/api/user/register",
        {
          userId: body.userId,
          email: body.email,
          password: body.password,
          full_name: body.full_name,
          givenName: body.givenName || body.full_name.split(' ')[0],
          sn: body.sn || body.full_name.split(' ').slice(1).join(' ') || 'User',
          role: body.role || 'end_user',
        }
      )
      .then((r) => r.data),

  logout: () =>
    apiClient
      .post<ApiResponse<null>>("/api/user/logout", {})
      .then((r) => r.data),

  refresh: () =>
    apiClient
      .post<ApiResponse<{ token: string }>>("/api/user/refresh", {})
      .then((r) => r.data),

  me: () =>
    apiClient.get<ApiResponse<User>>("/api/user/me").then((r) => r.data),

  changePassword: (body: { current_password: string; new_password: string }) =>
    apiClient
      .put<ApiResponse<null>>("/api/user/password", body)
      .then((r) => r.data),

  getSessions: () =>
    apiClient.get<ApiResponse<Session[]>>("/auth/sessions").then((r) => r.data),

  deleteSession: (id: string) =>
    apiClient
      .delete<ApiResponse<null>>(`/auth/sessions/${id}`)
      .then((r) => r.data),

  // Check approval status in the governance DB
  checkStatus: (uid: string) =>
    apiClient
      .get<{ ok: boolean; status: number; data?: { isApproved: number; status: string } }>(`/api/users/${uid}`)
      .then((r) => r.data),
};

