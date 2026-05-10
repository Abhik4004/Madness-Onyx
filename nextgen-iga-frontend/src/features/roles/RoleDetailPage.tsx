import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { PageHeader } from '../../components/layout/PageHeader';
import { rolesApi } from '../../api/users.api';

export function RoleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError } = useQuery({ queryKey: ['role', id], queryFn: () => rolesApi.get(id!), enabled: !!id });
  const role = data?.data;

  if (isLoading) return <div className="card"><div className="skeleton" style={{ height: 200 }} /></div>;
  if (isError || !role) return (
    <div className="error-state"><AlertTriangle size={32} className="error-state-icon" /><div className="error-state-title">Role not found</div><Link to="/admin/roles" className="btn btn-secondary">← Back</Link></div>
  );

  const perms = Array.isArray(role.permissions) ? role.permissions : [];
  const byResource = perms.reduce<Record<string, string[]>>((acc, p) => {
    if (!acc[p.resource]) acc[p.resource] = [];
    acc[p.resource].push(p.action);
    return acc;
  }, {});

  return (
    <div>
      <PageHeader
        title={role.name}
        breadcrumbs={[{ label: 'Roles', to: '/admin/roles' }, { label: role.name }]}
        subtitle={role.description}
      />
      <div className="card">
        <div className="card-header"><span className="card-title">Permissions Matrix</span><span className="text-sm text-muted">{perms.length} permissions</span></div>
        {Object.keys(byResource).length === 0 ? (
          <p className="text-sm text-muted">No permissions assigned to this role</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Resource</th><th>Allowed Actions</th></tr>
              </thead>
              <tbody>
                {Object.entries(byResource).map(([resource, actions]) => (
                  <tr key={resource}>
                    <td className="font-medium">{resource}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {actions.map(a => (
                          <span key={a} style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)', padding: '2px 8px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 600 }}>{a}</span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
