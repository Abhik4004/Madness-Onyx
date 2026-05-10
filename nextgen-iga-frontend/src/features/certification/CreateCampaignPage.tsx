import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PageHeader } from '../../components/layout/PageHeader';
import { certificationApi } from '../../api/certification.api';
import { usersApi } from '../../api/users.api';

const schema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().min(1, 'End date is required'),
  ownerId: z.string().optional(),
  scopeType: z.enum(['DIRECT_REPORTS', 'FULL_HIERARCHY']),
}).refine(d => d.end_date > d.start_date, { message: 'End date must be after start date', path: ['end_date'] });

type FormData = z.infer<typeof schema>;

export function CreateCampaignPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({ 
    resolver: zodResolver(schema),
    defaultValues: { scopeType: 'DIRECT_REPORTS' }
  });

  const { data: usersData } = useQuery({
    queryKey: ['users', 'managers'],
    queryFn: () => usersApi.list({ role: 'supervisor' })
  });
  const managers = usersData?.data ?? [];

  const create = useMutation({
    mutationFn: (data: FormData) => certificationApi.create(data),
    onSuccess: (res) => {
      toast.success('Campaign created!');
      qc.invalidateQueries({ queryKey: ['certifications'] });
      navigate('/admin/certifications/history');
    },
    onError: () => toast.error('Failed to create campaign'),
  });

  return (
    <div>
      <PageHeader
        title="New Certification Campaign"
        breadcrumbs={[{ label: 'Certifications', to: '/admin/certifications' }, { label: 'New Campaign' }]}
      />
      <div className="card" style={{ maxWidth: 600 }}>
        <form onSubmit={handleSubmit(d => create.mutate(d))}>
          <div className="form-group">
            <label className="form-label required">Campaign Name</label>
            <input className={`form-control ${errors.name ? 'error' : ''}`} placeholder="Q1 2025 Access Review" {...register('name')} />
            {errors.name && <span className="form-error">{errors.name.message}</span>}
          </div>
          <div className="form-group">
            <label className="form-label">Assign Certification Owner (Optional)</label>
            <select className="form-control" {...register('ownerId')}>
              <option value="">System (Global)</option>
              {managers.map(m => (
                <option key={m.id} value={m.id}>{m.full_name} ({m.id})</option>
              ))}
            </select>
            <span className="form-hint">The manager/supervisor responsible for reviewing these users</span>
          </div>

          <div className="form-group">
            <label className="form-label">Hierarchy Scope</label>
            <select className="form-control" {...register('scopeType')}>
              <option value="DIRECT_REPORTS">Direct Reports Only</option>
              <option value="FULL_HIERARCHY">Full Reporting Tree</option>
            </select>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label required">Start Date</label>
              <input type="date" className={`form-control ${errors.start_date ? 'error' : ''}`} {...register('start_date')} />
              {errors.start_date && <span className="form-error">{errors.start_date.message}</span>}
            </div>
            <div className="form-group">
              <label className="form-label required">End Date</label>
              <input type="date" className={`form-control ${errors.end_date ? 'error' : ''}`} {...register('end_date')} />
              {errors.end_date && <span className="form-error">{errors.end_date.message}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <Link to="/admin/certifications" className="btn btn-secondary">Cancel</Link>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting || create.isPending}>
              {create.isPending ? <span className="spinner" /> : null} Create Campaign
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
