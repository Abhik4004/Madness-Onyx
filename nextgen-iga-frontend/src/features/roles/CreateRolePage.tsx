import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { PageHeader } from '../../components/layout/PageHeader';
import { rolesApi } from '../../api/users.api';

const schema = z.object({
  name: z.string().min(2),
  description: z.string().min(5),
});
type FormData = z.infer<typeof schema>;

export function CreateRolePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);

  const { data: permsData } = useQuery({ queryKey: ['permissions'], queryFn: () => rolesApi.listPermissions() });
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema) });

  const create = useMutation({
    mutationFn: (data: FormData) => rolesApi.create({ ...data, permission_ids: selectedPerms }),
    onSuccess: (res) => {
      toast.success('Role created');
      qc.invalidateQueries({ queryKey: ['roles'] });
      navigate(`/admin/roles/${res.data!.id}`);
    },
    onError: () => toast.error('Failed to create role'),
  });

  const perms = permsData?.data ?? [];
  const byResource = perms.reduce<Record<string, typeof perms>>((acc, p) => {
    if (!acc[p.resource]) acc[p.resource] = [];
    acc[p.resource].push(p);
    return acc;
  }, {});

  const toggle = (id: string) => setSelectedPerms(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  return (
    <div>
      <PageHeader title="Create Role" breadcrumbs={[{ label: 'Roles', to: '/admin/roles' }, { label: 'New Role' }]} />
      <div className="card" style={{ maxWidth: 680 }}>
        <form onSubmit={handleSubmit(d => create.mutate(d))}>
          <div className="form-group">
            <label className="form-label required">Role Name</label>
            <input className={`form-control ${errors.name ? 'error' : ''}`} {...register('name')} />
            {errors.name && <span className="form-error">{errors.name.message}</span>}
          </div>
          <div className="form-group">
            <label className="form-label required">Description</label>
            <textarea className={`form-control ${errors.description ? 'error' : ''}`} {...register('description')} />
            {errors.description && <span className="form-error">{errors.description.message}</span>}
          </div>

          <div className="form-group">
            <label className="form-label">Permissions</label>
            {Object.entries(byResource).map(([resource, items]) => (
              <div key={resource} style={{ marginBottom: 16 }}>
                <div className="font-semibold text-sm" style={{ marginBottom: 8, textTransform: 'capitalize' }}>{resource}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {items.map(p => (
                    <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.8rem' }}>
                      <input type="checkbox" checked={selectedPerms.includes(p.id)} onChange={() => toggle(p.id)} />
                      {p.action}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <Link to="/admin/roles" className="btn btn-secondary">Cancel</Link>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting || create.isPending}>
              {create.isPending ? <span className="spinner" /> : null} Create Role
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
