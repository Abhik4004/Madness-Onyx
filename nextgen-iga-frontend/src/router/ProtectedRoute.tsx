import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useAuthStore } from '../stores/auth.store';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const location = useLocation();

  // Wait for localStorage rehydration before deciding to redirect
  if (!hasHydrated) {
    return null; // or a small spinner
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <>{children}</>;
}
