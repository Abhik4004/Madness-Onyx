import { useAuthStore } from '../stores/auth.store';
import type { UserRole } from '../types/auth.types';

const ROLE_RANK: Record<UserRole, number> = {
  end_user: 1,
  supervisor: 2,
  admin: 3,
};

export function usePermissions() {
  const user = useAuthStore((s) => s.user);
  const role = user?.role ?? 'end_user';

  const hasRole = (required: UserRole) =>
    ROLE_RANK[role] >= ROLE_RANK[required];

  const isAdmin = role === 'admin';
  const isSupervisor = hasRole('supervisor');
  const isEndUser = role === 'end_user';

  return { role, hasRole, isAdmin, isSupervisor, isEndUser };
}
