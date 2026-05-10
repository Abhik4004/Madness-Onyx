import { Link } from 'react-router-dom';
import { ShieldOff } from 'lucide-react';

export function ForbiddenPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 24 }}>
      <ShieldOff size={48} color="var(--color-danger)" />
      <h1 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--color-gray-900)' }}>403 — Forbidden</h1>
      <p style={{ color: 'var(--color-gray-500)', fontSize: '1rem' }}>You don't have permission to access this page.</p>
      <Link to="/dashboard" className="btn btn-primary">Go to Dashboard</Link>
    </div>
  );
}
