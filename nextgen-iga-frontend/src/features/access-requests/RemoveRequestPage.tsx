import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeader } from '../../components/layout/PageHeader';
import { DataTable, type Column } from '../../components/shared/DataTable';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { provisionApi } from '../../api/provision.api';
import { requestsApi } from '../../api/requests.api';
import { formatDate } from '../../lib/utils';

export function RemoveRequestPage() {
  const [search, setSearch] = useState('');
  const [removeTarget, setRemoveTarget] = useState<any | null>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['activeAccess'],
    queryFn: () => provisionApi.listActiveAccess(),
  });

  const activeAccess = (data?.data ?? []).filter((a: any) => a.access_type !== 'TIME_BASED') as any[];

  const filtered = useMemo(() => {
    if (!search) return activeAccess;
    const q = search.toLowerCase();
    return activeAccess.filter(a => 
      a.application_name.toLowerCase().includes(q) ||
      a.user_name.toLowerCase().includes(q)
    );
  }, [activeAccess, search]);

  const removeMutation = useMutation({
    mutationFn: (target: any) => requestsApi.removeRequest(target.user_id, target.application_id),
    onSuccess: (res) => {
      if (res.statusCode === 200) {
        toast.success(res.message || 'User removed from group successfully');
        qc.invalidateQueries({ queryKey: ['activeAccess'] });
      } else {
        toast.error(res.message || 'Failed to remove user');
      }
      setRemoveTarget(null);
    },
    onError: () => {
      toast.error('Failed to process removal request');
      setRemoveTarget(null);
    },
  });

  const columns: Column<any>[] = [
    { key: 'user', header: 'User', render: a => a.user_name },
    { key: 'app', header: 'Entitlement', render: a => a.application_name },
    { key: 'status', header: 'Status', render: a => <StatusBadge status={a.status} /> },
    { key: 'granted', header: 'Granted At', render: a => formatDate(a.granted_at) },
    {
      key: 'actions', header: '', width: '120px',
      render: a => a.status === 'ACTIVE' ? (
        <button 
          className="btn btn-sm btn-danger btn-full" 
          onClick={() => setRemoveTarget(a)}
          disabled={removeMutation.isPending}
        >
          <Trash2 size={14} style={{ marginRight: 6 }} /> Request Removal
        </button>
      ) : <span className="text-xs text-muted" style={{ display: 'block', textAlign: 'center' }}>Revoked</span>
    }
  ];

  return (
    <div className="fade-in">
      <PageHeader 
        title="Remove Request" 
        subtitle="Request to remove access/entitlements for yourself or your reports" 
      />

      <div className="card mb-6" style={{ padding: '12px 20px' }}>
        <div className="search-input-wrap" style={{ maxWidth: 450 }}>
          <Search size={16} className="text-muted" />
          <input 
            className="form-control border-0 bg-transparent focus-none" 
            placeholder="Search by user or entitlement..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        loading={isLoading}
        emptyTitle="No active entitlements found"
      />

      <ConfirmDialog
        open={!!removeTarget}
        title="Confirm Removal Request"
        message={`Are you sure you want to request removal of ${removeTarget?.user_name} from ${removeTarget?.application_name}?`}
        confirmLabel="Confirm Removal"
        danger
        loading={removeMutation.isPending}
        onConfirm={() => removeMutation.mutate(removeTarget)}
        onCancel={() => setRemoveTarget(null)}
      />
    </div>
  );
}
