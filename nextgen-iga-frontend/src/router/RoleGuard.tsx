import { Navigate } from 'react-router-dom';
import { usePermissions } from '../hooks/usePermissions';
import type { UserRole } from '../types/auth.types';

interface Props {
  required: UserRole;
  children: React.ReactNode;
}

export function RoleGuard({ required, children }: Props) {
  const { hasRole } = usePermissions();
  if (!hasRole(required)) return <Navigate to="/403" replace />;
  return <>{children}</>;
}
