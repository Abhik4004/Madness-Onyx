import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeader } from '../../components/layout/PageHeader';
import { DataTable, type Column } from '../../components/shared/DataTable';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { provisionApi } from '../../api/provision.api';
import { usePagination } from '../../hooks/usePagination';
import { formatDate } from '../../lib/utils';
import type { UserAccess } from '../../types/provision.types';

export function ActiveAccessPage() {
  const { page, perPage, setPage } = usePagination();
  const [search, setSearch] = useState('');
  const [revokeTarget, setRevokeTarget] = useState<any | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const qc = useQueryClient();

  const activeQuery = useQuery({
    queryKey: ['activeAccess'],
    queryFn: () => provisionApi.listActiveAccess(),
    refetchInterval: 30000,
  });

  const timeQuery = useQuery({
    queryKey: ['timeAccess'],
    queryFn: () => provisionApi.listTimeAccess(),
    refetchInterval: 30000,
  });

  // ── Normalize disparate access records ──
  const normalizedData = useMemo(() => {
    const rawActive = (activeQuery.data?.data ?? []) as any[];
    const rawTime = (timeQuery.data?.data ?? []) as any[];

    const normalize = (a: any) => ({
      id: a.id,
      user_id: a.user_id,
      user_name: a.user_name || a.uid || 'System User',
      application_id: a.application_id || a.resource_id,
      application_name: a.application_name || a.resource_name || a.resource_id || a.application_id || 'Unknown App',
      role_name: a.role_name || a.access_type || 'Default',
      status: a.status || 'ACTIVE',
      granted_at: a.granted_at || a.starts_at || a.created_at,
      expires_at: a.expires_at || a.valid_to || null,
    });

    return [...rawActive, ...rawTime].map(normalize);
  }, [activeQuery.data, timeQuery.data]);

  const filtered = useMemo(() => {
    if (!search) return normalizedData;
    const q = search.toLowerCase();
    return normalizedData.filter(a => 
      a.application_name.toLowerCase().includes(q) ||
      a.user_name.toLowerCase().includes(q) ||
      a.application_id.toLowerCase().includes(q)
    );
  }, [normalizedData, search]);

  const revoke = useMutation({
    mutationFn: () =>
      provisionApi.revoke({
        user_id: revokeTarget!.user_id,
        application_id: revokeTarget!.application_id,
        reason: revokeReason,
      }),
    onSuccess: () => {
      toast.success('Revocation request sent');
      qc.invalidateQueries({ queryKey: ['activeAccess'] });
      qc.invalidateQueries({ queryKey: ['timeAccess'] });
      setRevokeTarget(null);
    },
    onError: () => toast.error('Failed to initiate revocation'),
  });

  const columns: Column<any>[] = [
    { 
      key: 'app', 
      header: 'Application', 
      render: a => (
        <div className="flex flex-col">
          <span className="font-bold text-gray-900">{a.application_name}</span>
          <span className="text-xs text-muted font-mono">{a.application_id}</span>
        </div>
      ) 
    },
    { key: 'status', header: 'Status', render: a => <StatusBadge status={a.status} /> },
    { key: 'granted', header: 'Granted', render: a => formatDate(a.granted_at) },
    { key: 'expires', header: 'Expires', render: a => a.expires_at ? formatDate(a.expires_at) : <span className="text-muted italic">Permanent</span> },
    {
      key: 'actions', header: '', width: '100px',
      render: a => a.status === 'ACTIVE' ? (
        <button className="btn btn-sm btn-danger btn-full" onClick={() => { setRevokeTarget(a); setRevokeReason(''); }}>
          Revoke
        </button>
      ) : null,
    },
  ];

  return (
    <div className="fade-in">
      <PageHeader title="Active Access" subtitle="Manage provisioned entitlements and time-based access" />

      <div className="card mb-6" style={{ padding: '12px 20px' }}>
        <div className="search-input-wrap" style={{ maxWidth: 450 }}>
          <Search size={16} className="text-muted" />
          <input 
            className="form-control border-0 bg-transparent focus-none" 
            placeholder="Search by application name or ID..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        loading={activeQuery.isLoading || timeQuery.isLoading}
        emptyTitle="No active access records found"
      />

      <ConfirmDialog
        open={!!revokeTarget}
        title="Revoke Entitlement"
        message={`This will immediately revoke access to ${revokeTarget?.application_name} for the user. Proceed?`}
        confirmLabel="Confirm Revoke"
        danger
        loading={revoke.isPending}
        onConfirm={() => revoke.mutate()}
        onCancel={() => setRevokeTarget(null)}
      />
    </div>
  );
}
