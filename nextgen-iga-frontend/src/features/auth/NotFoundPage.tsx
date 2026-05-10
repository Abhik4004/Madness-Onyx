import { Link } from 'react-router-dom';
import { SearchX } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 24 }}>
      <SearchX size={48} color="var(--color-gray-400)" />
      <h1 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--color-gray-900)' }}>404 — Not Found</h1>
      <p style={{ color: 'var(--color-gray-500)', fontSize: '1rem' }}>The page you're looking for doesn't exist.</p>
      <Link to="/dashboard" className="btn btn-primary">Go to Dashboard</Link>
    </div>
  );
}
