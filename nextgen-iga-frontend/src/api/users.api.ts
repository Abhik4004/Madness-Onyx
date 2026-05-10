import { apiClient } from "../lib/axios";
import type { ApiResponse } from "../types/api.types";
import type { UserRole } from "../types/auth.types";
import type { UserAccess } from "../types/provision.types";
import type { Role, Permission } from "../types/audit.types";

// ── Normalized User shape for UI ──────────────────────────────────────────
export interface User {
  id: string;
  uid: string;
  full_name: string;
  email: string;
  cn: string;
  sn: string;
  givenName: string;
  mail: string;
  role: string;
  status: string;
  isApproved: boolean;
  manager: string | null;
  manager_id?: string | null;
  groups: string[];
  dn: string;
  additionalAttributes: Record<string, unknown>;
}

// ── Raw shapes from LDAP backend ──────────────────────────────────────────
interface RawProvisionUser {
  uid: string;
  cn: string;
  sn: string;
  givenName: string;
  mail: string;
  role?: string;
  additionalAttributes: Record<string, unknown>;
}

/**
 * Standard gateway response for admin/users endpoints.
 * Shape: { ok, status, message, data }
 */
interface AdminUsersResponse {
  ok: boolean;
  status: number;
  message: string;
  data: RawProvisionUser[];
}

interface AdminUserResponse {
  ok: boolean;
  status: number;
  message: string;
  data: RawProvisionUser;
}

interface AdminUserGroupsResponse {
  ok: boolean;
  status: number;
  message: string;
  data: {
    uid: string;
    groups: string[];
  };
}

// ── Normalizer ────────────────────────────────────────────────────────────
function decodeJwtPayload(token: string): any {
  try {
    const payload = token.split('.')[1];
    // Works in both browser (atob) and Node (Buffer)
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function normalizeUser(u: any): User {
  const attrs = u.additionalAttributes ?? {};

  // Parse carLicense SSO tokens (Safe Parse)
  let ssoTokens: any = null;
  const carLicenseRaw = attrs.carLicense ? String(attrs.carLicense) : null;
  if (carLicenseRaw && carLicenseRaw.trim().startsWith('{')) {
    try {
      ssoTokens = JSON.parse(carLicenseRaw);
    } catch {
      console.warn(`[auth] carLicense for ${u.uid} is not valid JSON, skipping.`);
    }
  }

  // Role priority:
  // 1. Direct role field (from our HTTP bypass/Local DB)
  // 2. Direct userType field
  // 3. JWT payload inside carLicense.jwtToken
  // 4. Top-level groups array
  // 5. Default: end_user
  let role: string = u.role || u.userType || attrs.role || '';

  if (!role && ssoTokens?.jwtToken) {
    const payload = decodeJwtPayload(ssoTokens.jwtToken);
    if (payload?.role) role = payload.role;
  }

  if (!role && Array.isArray(u.groups)) {
    if (u.groups.includes('admin')) role = 'admin';
    else if (u.groups.includes('supervisor')) role = 'supervisor';
    else if (u.groups.includes('user')) role = 'end_user';
  }

  role = role || 'end_user';
  if (role === 'user') role = 'end_user';

  // Extract manager UID from LDAP DN string in 'manager' or 'member' field
  let manager: string | null = null;
  const managerRaw = u.manager || u.manager_id || u.member || attrs.manager;
  if (managerRaw) {
    const match = String(managerRaw).match(/uid=([^,]+)/i);
    manager = match ? match[1] : String(managerRaw);
  }

  let groups: string[] = u.groups || [];

  // If no groups from backend, use the role as a default group
  if (groups.length === 0 && role) {
    groups = [role];
  }

  // Clean up roles to be more readable (e.g. end_user -> End User)
  groups = groups.map(g => g.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));


  console.log(`[debug] Normalizing user: rawUid=${u.uid}, rawCn=${u.cn}, role=${role}`);

  const uid = u.uid || u.cn || attrs.uid || u.userId || '';
  if (!uid) {
    console.debug('[normalizeUser] UID missing for user:', u);
  }

  const normalized = {
    ...u,
    id: uid,
    uid,
    full_name: u.full_name || u.cn || u.displayName || `${u.givenName || ''} ${u.sn || ''}`.trim() || uid,
    email: u.email || u.mail || u.userPrincipalName || `${uid}@example.com`,
    role,
    status: (u.status || 'ACTIVE') as string,
    isApproved: u.isApproved === true || u.isApproved === 1,
    manager,
    manager_id: u.manager_id || manager,
    groups,
    dn: u.dn || u.entryDN || attrs.entryDN || `uid=${uid},ou=users,dc=example,dc=com`,
    additionalAttributes: { ...attrs, ssoTokens },
  };

  console.log(`[debug] Normalized user result:`, normalized.uid, normalized.full_name);
  return normalized;
}

// ══════════════════════════════════════════════════════════════════════════
//  USERS API — All requests go through Gateway at /api/admin/users
// ══════════════════════════════════════════════════════════════════════════
export const usersApi = {
  /**
   * GET /api/admin/users
   * → Gateway → LDAP backend GET /api/users
   * NATS subject: n/a (direct HTTP proxy in gateway)
   *
   * Request:  query params { search?, role?, status? }
   * Response: { ok, status, message, data: User[] }
   */
  list: (params: {
    search?: string;
    role?: string;
    status?: string;
    page?: number;
    per_page?: number;
  }) =>
    apiClient
      .get<AdminUsersResponse>(`/api/users`, {
        params: {
          search: params.search,
          role: params.role,
          status: params.status,
          page: params.page,
          per_page: params.per_page,
        }
      })
      .then((r) => {
        // Robust Deep Extraction: Drill down through nested .data until we find an array
        let rawItems: any[] = [];
        let current: any = r.data;
        
        // Max 3 levels of nesting to avoid infinite loops
        for (let i = 0; i < 3; i++) {
          if (Array.isArray(current)) {
            rawItems = current;
            break;
          }
          if (current && typeof current === 'object') {
            // Priority list of keys to look for
            current = (current as any).data || (current as any).users || (current as any).items;
          } else {
            break;
          }
        }

        console.log(`[UserListPage] DEEP EXTRACTION: found ${rawItems.length} users`, {
          fullResponse: r.data,
          firstItem: rawItems[0]
        });
        
        return {
          ok: r.data?.ok ?? true,
          status: r.data?.status ?? 200,
          data: Array.isArray(rawItems) ? rawItems.map(normalizeUser) : [],
        };
      }),

  /**
   * GET /api/users/:uid
   * → Gateway → LDAP backend GET /api/users (filtered server-side)
   *
   * Request:  path param :uid
   * Response: { ok, status, message, data: User }
   */
  get: (uid: string) =>
    apiClient
      .get<AdminUserResponse>(`/api/users/${uid}`)
      .then((r) => ({
        ...r.data,
        data: r.data.data ? normalizeUser(r.data.data) : undefined,
      })),

  /**
   * POST /api/users/details
   * → Gateway → relayMiddleware → NATS subject: admin.user.details.get
   *
   * Request:  body { uid: string }
   * Response: { statusCode, message, data: RawUser }
   */
  getDetails: (uid: string, token?: string) =>
    apiClient
      .post<ApiResponse<any>>(`/api/user/details`, { uid }, token ? { headers: { Authorization: `Bearer ${token}` } } : {})
      .then((r) => ({
        ...r.data,
        data: r.data.data ? normalizeUser(r.data.data) : undefined,
      })),

  /**
   * POST /api/users/approve
   * → Gateway → Access-Management bypass
   */
  approveUser: (userId: string) =>
    apiClient
      .post<ApiResponse<any>>("/api/users/approve", { userId })
      .then((r) => r.data),

  /**
   * POST /api/user/sync
   * → Gateway → relayMiddleware → NATS subject: access.user.sync
   */
  syncUser: (userData: any, token?: string) =>
    apiClient
      .post<ApiResponse<any>>(`/api/user/sync`, userData, token ? { headers: { Authorization: `Bearer ${token}` } } : {})
      .then((r) => r.data),

  /**
   * POST /api/users/update
   * → Gateway → relayMiddleware → NATS subject: admin.users.update
   *
   * Request:  body { users: [ { uid, attributes: { ... } } ] }
   * Response: { ok, status, message }
   */
  updateAttributes: (uid: string, attributes: Record<string, any>) => {
    const payload = { users: [{ uid, attributes }] };
    console.log('[usersApi] updateAttributes payload:', JSON.stringify(payload, null, 2));
    return apiClient
      .post<ApiResponse<null>>(`/api/users/update`, payload)
      .then((r) => r.data);
  },

  /**
   * GET /api/users/:uid/groups
   * → Gateway → parses LDAP additionalAttributes.memberOf
   *
   * Request:  path param :uid
   * Response: { ok, status, message, data: { uid, groups: string[] } }
   */
  getUserGroups: (uid: string) =>
    apiClient
      .get<AdminUserGroupsResponse>(`/api/users/${uid}/groups`)
      .then((r) => r.data),

  /**
   * PUT /api/user/:id/role
   * → Gateway → relayMiddleware → NATS subject: events.user.role.update
   *
   * Request:  body { role: 'end_user' | 'supervisor' | 'admin' }
   * Response: { ok, status: 202, message, requestId }
   */
  updateRole: (id: string, role: UserRole) =>
    apiClient
      .put<ApiResponse<null>>(`/api/user/${id}/role`, { role })
      .then((r) => r.data),

  /**
   * PUT /api/user/:id/deactivate
   * → Gateway → relayMiddleware → NATS subject: events.user.deactivate
   *
   * Request:  path param :id
   * Response: { ok, status: 202, message, requestId }
   */
  deactivate: (id: string) =>
    apiClient
      .put<ApiResponse<null>>(`/api/user/${id}/deactivate`)
      .then((r) => r.data),

  /**
   * GET /api/user/:id/access
   * → Gateway → relayMiddleware → NATS subject: user.access.list
   */
  getUserAccess: (id: string) =>
    apiClient
      .get<ApiResponse<UserAccess[]>>(`/api/user/${id}/access`)
      .then((r) => r.data),

  /**
   * POST /api/user/access/details
   * → Gateway → relayMiddleware → NATS subject: access.user.list (Access Mgmt Server)
   */
  getUserAccessDetails: (uid: string) =>
    apiClient
      .post<ApiResponse<UserAccess[]>>(`/api/user/access/details`, { uid })
      .then((r) => r.data),

  /**
   * POST /api/admin/user/approve
   */
  adminApprove: (userId: string, mfaLink?: string) =>
    apiClient.post<ApiResponse<any>>("/api/admin/user/approve", { userId, mfaLink }).then((r) => r.data),

  /**
   * POST /api/admin/users/:uid/approve
   */
  approve: (uid: string) =>
    apiClient.post<ApiResponse<null>>(`/api/admin/users/${uid}/approve`, {}).then(r => r.data),

  /**
   * POST /api/access/user/sync
   */
  syncLdap: () =>
    apiClient.post<ApiResponse<null>>(`/api/access/user/sync`, {}).then(r => r.data),

  /**
   * POST /api/users/group
   * → Gateway → relayMiddleware → NATS subject: admin.user.group.add
   *
   * Request:  body { uid: string, groupCn: string }
   * Response: { ok, status, message }
   */
  addToGroup: (uid: string, groupCn: string) =>
    apiClient
      .post<ApiResponse<null>>(`/api/users/group`, { uid, groupCn })
      .then((r) => r.data),

  /**
   * DELETE /api/users/group
   * → Gateway → relayMiddleware → NATS subject: admin.user.group.remove
   *
   * Request:  body { uid: string, groupCn: string }
   * Response: { ok, status, message }
   */
  removeFromGroup: (uid: string, groupCn: string) =>
    apiClient
      .delete<ApiResponse<null>>(`/api/users/group`, {
        data: { uid, groupCn },
      })
      .then((r) => r.data),

  /**
   * GET /api/admin/org/hierarchy
   * → Gateway → relayMiddleware → NATS subject: admin.org.hierarchy
   */
  getHierarchy: (userId?: string) =>
    apiClient
      .get<ApiResponse<any>>(`/api/admin/org/hierarchy`, { params: { userId } })
      .then((r) => r.data),
};

// ══════════════════════════════════════════════════════════════════════════
//  ROLES API — Gateway → relayMiddleware → NATS
// ══════════════════════════════════════════════════════════════════════════
export const rolesApi = {
  /**
   * GET /api/roles
   * → Gateway → relayMiddleware → NATS subject: roles.list
   * Response: { ok, status, data: Role[] }
   */
  list: () =>
    apiClient.get<ApiResponse<Role[]>>("/api/roles").then((r) => r.data),

  /**
   * GET /api/roles/:id
   * → Gateway → relayMiddleware → NATS subject: roles.get
   * Response: { ok, status, data: Role }
   */
  get: (id: string) =>
    apiClient.get<ApiResponse<Role>>(`/api/roles/${id}`).then((r) => r.data),

  /**
   * POST /api/roles
   * → Gateway → relayMiddleware → NATS subject: events.roles.create
   * Response: { ok, status: 202, message, requestId }
   */
  create: (body: {
    name: string;
    description: string;
    permission_ids: string[];
  }) =>
    apiClient.post<ApiResponse<Role>>("/api/roles", body).then((r) => r.data),

  /**
   * PUT /api/roles/:id
   * → Gateway → relayMiddleware → NATS subject: events.roles.update
   * Response: { ok, status: 202, message, requestId }
   */
  update: (
    id: string,
    body: { name: string; description: string; permission_ids: string[] },
  ) =>
    apiClient
      .put<ApiResponse<Role>>(`/api/roles/${id}`, body)
      .then((r) => r.data),

  /**
   * GET /api/permissions
   * → Gateway → relayMiddleware → NATS subject: permissions.list
   * Response: { ok, status, data: Permission[] }
   */
  listPermissions: () =>
    apiClient
      .get<ApiResponse<Permission[]>>("/api/permissions")
      .then((r) => r.data),
};
