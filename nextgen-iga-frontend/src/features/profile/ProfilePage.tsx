import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { PageHeader } from '../../components/layout/PageHeader';
import { authApi } from '../../api/auth.api';
import { notificationsApi } from '../../api/notifications.api';
import { provisionApi } from '../../api/provision.api';
import { useAuth } from '../../hooks/useAuth';
import { formatDate } from '../../lib/utils';

const pwSchema = z.object({
  current_password: z.string().min(1, 'Required'),
  new_password: z.string().min(8, 'Minimum 8 characters'),
  confirm_password: z.string(),
}).refine(d => d.new_password === d.confirm_password, { message: 'Passwords do not match', path: ['confirm_password'] });
type PwFormData = z.infer<typeof pwSchema>;

export function ProfilePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'profile' | 'security' | 'notifications'>('profile');

  const { data: prefsData, isLoading: prefsLoading } = useQuery({
    queryKey: ['notifPrefs'],
    queryFn: () => notificationsApi.getPreferences(),
  });

  const { data: accessData } = useQuery({
    queryKey: ['userAccess', user?.id],
    queryFn: () => provisionApi.getUserAccess(user!.id),
    enabled: !!user?.id,
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<PwFormData>({ resolver: zodResolver(pwSchema) });

  const changePw = useMutation({
    mutationFn: (data: PwFormData) => authApi.changePassword({ current_password: data.current_password, new_password: data.new_password }),
    onSuccess: () => { toast.success('Password changed'); reset(); },
    onError: () => toast.error('Failed to change password'),
  });

  const updatePrefs = useMutation({
    mutationFn: (prefs: import('../../types/notification.types').NotificationPreference[]) => notificationsApi.updatePreferences(prefs),
    onSuccess: () => { toast.success('Preferences saved'); qc.invalidateQueries({ queryKey: ['notifPrefs'] }); },
    onError: () => toast.error('Failed to save preferences'),
  });

  const prefs = prefsData?.data ?? [];

  const togglePref = (idx: number, field: 'email_enabled' | 'in_app_enabled') => {
    const updated = prefs.map((p, i) => i === idx ? { ...p, [field]: !p[field] } : p);
    updatePrefs.mutate(updated);
  };

  const managerName = user?.role === 'admin' 
    ? 'System Owner' 
    : user?.role === 'supervisor' 
      ? 'System Administrator' 
      : 'Assigned Supervisor';

  const activeAccess = (accessData?.data ?? []).filter(a => a.status === 'ACTIVE');
  const groups = Array.from(new Set(activeAccess.map(a => a.role_name)));
  const applications = Array.from(new Set(activeAccess.map(a => a.application_name)));

  return (
    <div>
      <PageHeader title="My Profile" subtitle="Manage your account settings and preferences" />

      <div className="tabs">
        {(['profile', 'security', 'notifications'] as const).map(t => (
          <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <div className="card" style={{ maxWidth: 480 }}>
          <div className="card-header"><span className="card-title">Account Information</span></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Full Name', value: user?.full_name },
              { label: 'Email', value: user?.email },
              { label: 'Role', value: user?.role?.replace('_', ' ') },
              { label: 'Manager', value: managerName },
              { label: 'Groups', value: groups.length > 0 ? groups.join(', ') : 'None' },
              { label: 'Access', value: applications.length > 0 ? applications.join(', ') : 'None' },
              { label: 'Status', value: user?.status },
              { label: 'Member Since', value: user?.created_at ? formatDate(user.created_at) : '—' },
            ].map(item => (
              <div key={item.label} style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: 8, padding: '10px 0', borderBottom: '1px solid var(--color-gray-100)' }}>
                <span className="text-xs text-muted font-semibold" style={{ textTransform: 'uppercase', letterSpacing: '0.4px', paddingTop: 2 }}>{item.label}</span>
                <span className="text-sm font-medium">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'security' && (
        <div className="card" style={{ maxWidth: 480 }}>
          <div className="card-header"><span className="card-title">Change Password</span></div>
          <form onSubmit={handleSubmit(d => changePw.mutate(d))}>
            <div className="form-group">
              <label className="form-label required">Current Password</label>
              <input type="password" className={`form-control ${errors.current_password ? 'error' : ''}`} {...register('current_password')} />
              {errors.current_password && <span className="form-error">{errors.current_password.message}</span>}
            </div>
            <div className="form-group">
              <label className="form-label required">New Password</label>
              <input type="password" className={`form-control ${errors.new_password ? 'error' : ''}`} {...register('new_password')} />
              {errors.new_password && <span className="form-error">{errors.new_password.message}</span>}
            </div>
            <div className="form-group">
              <label className="form-label required">Confirm Password</label>
              <input type="password" className={`form-control ${errors.confirm_password ? 'error' : ''}`} {...register('confirm_password')} />
              {errors.confirm_password && <span className="form-error">{errors.confirm_password.message}</span>}
            </div>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting || changePw.isPending}>
              {changePw.isPending ? <span className="spinner" /> : null} Update Password
            </button>
          </form>
        </div>
      )}

      {tab === 'notifications' && (
        <div className="card" style={{ maxWidth: 600 }}>
          <div className="card-header"><span className="card-title">Notification Preferences</span></div>
          {prefsLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{[1,2,3].map(i => <div key={i} className="skeleton skeleton-text w-full" style={{ height: 44 }} />)}</div>
          ) : prefs.length === 0 ? (
            <p className="text-sm text-muted">No notification preferences available</p>
          ) : (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px', gap: 8, padding: '8px 0', borderBottom: '2px solid var(--color-gray-200)', marginBottom: 8 }}>
                <span className="text-xs font-semibold text-muted" style={{ textTransform: 'uppercase' }}>Event</span>
                <span className="text-xs font-semibold text-muted" style={{ textTransform: 'uppercase', textAlign: 'center' }}>Email</span>
                <span className="text-xs font-semibold text-muted" style={{ textTransform: 'uppercase', textAlign: 'center' }}>In-App</span>
              </div>
              {prefs.map((pref, idx) => (
                <div key={pref.event_type} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px', gap: 8, padding: '12px 0', borderBottom: '1px solid var(--color-gray-100)', alignItems: 'center' }}>
                  <span className="text-sm">{pref.label}</span>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <label className="toggle">
                      <input type="checkbox" checked={pref.email_enabled} onChange={() => togglePref(idx, 'email_enabled')} />
                      <span className="toggle-track" />
                      <span className="toggle-thumb" />
                    </label>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <label className="toggle">
                      <input type="checkbox" checked={pref.in_app_enabled} onChange={() => togglePref(idx, 'in_app_enabled')} />
                      <span className="toggle-track" />
                      <span className="toggle-thumb" />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
