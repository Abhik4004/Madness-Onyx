import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { PageHeader } from '../../components/layout/PageHeader';
import { usersApi } from '../../api/users.api';
import type { UserRole } from '../../types/auth.types';

const schema = z.object({ role: z.enum(['end_user', 'supervisor', 'admin']) });
type FormData = z.infer<typeof schema>;

export function EditUserRolePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const userQuery = useQuery({ queryKey: ['user', id], queryFn: () => usersApi.get(id!), enabled: !!id });
  const user = userQuery.data?.data;

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    values: user ? { role: (user.role as 'end_user' | 'supervisor' | 'admin') } : undefined,
  });

  const update = useMutation({
    mutationFn: (data: FormData) => usersApi.updateRole(id!, data.role),
    onSuccess: () => {
      toast.success('Role updated');
      qc.invalidateQueries({ queryKey: ['user', id] });
      navigate(`/admin/users/${id}`);
    },
    onError: () => toast.error('Failed to update role'),
  });

  return (
    <div>
      <PageHeader
        title="Edit User Role"
        breadcrumbs={[{ label: 'Users', to: '/admin/users' }, { label: user?.full_name ?? '…', to: `/admin/users/${id}` }, { label: 'Edit Role' }]}
      />
      <div className="card" style={{ maxWidth: 480 }}>
        {userQuery.isLoading ? (
          <div className="skeleton" style={{ height: 100 }} />
        ) : (
          <form onSubmit={handleSubmit(d => update.mutate(d))}>
            <div className="form-group">
              <label className="form-label">User</label>
              <div className="text-sm font-medium">{user?.full_name} ({user?.email})</div>
            </div>
            <div className="form-group">
              <label className="form-label required">Role</label>
              <select className={`form-control ${errors.role ? 'error' : ''}`} {...register('role')}>
                <option value="end_user">End User</option>
                <option value="supervisor">Supervisor</option>
                <option value="admin">Admin</option>
              </select>
              {errors.role && <span className="form-error">{errors.role.message}</span>}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <Link to={`/admin/users/${id}`} className="btn btn-secondary">Cancel</Link>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting || update.isPending}>
                {update.isPending ? <span className="spinner" /> : null} Save Role
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
