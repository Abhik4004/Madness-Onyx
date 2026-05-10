import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeader } from '../../components/layout/PageHeader';
import { DataTable, type Column } from '../../components/shared/DataTable';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { requestsApi } from '../../api/requests.api';
import { usePagination } from '../../hooks/usePagination';
import { formatDate } from '../../lib/utils';
import type { AccessRequest } from '../../types/request.types';

export function ApprovalQueuePage() {
  const { page, perPage, setPage } = usePagination();
  const [search, setSearch] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectOpen, setRejectOpen] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['approvals', { page }],
    queryFn: () => requestsApi.list({ page, per_page: perPage, status: 'PENDING' }),
  });

  const approve = useMutation({
    mutationFn: (id: string) => requestsApi.approve(id, {}),
    onMutate: (id) => setActionId(id),
    onSuccess: () => {
      toast.success('Request approved');
      qc.invalidateQueries({ queryKey: ['approvals'] });
    },
    onError: () => toast.error('Failed to approve'),
    onSettled: () => setActionId(null),
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      requestsApi.reject(id, { reason }),
    onSuccess: () => {
      toast.success('Request rejected');
      qc.invalidateQueries({ queryKey: ['approvals'] });
      setRejectOpen(null);
      setRejectReason('');
    },
    onError: () => toast.error('Failed to reject'),
  });

  const rows = (data?.data ?? []) as AccessRequest[];

  const filtered = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter(r => 
      r.user_name?.toLowerCase().includes(q) || 
      r.application_name?.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const columns: Column<AccessRequest>[] = [
    {
      key: 'requester',
      header: 'Requester',
      render: (r) => <span className="font-medium">{r.user_name}</span>,
    },
    {
      key: 'application',
      header: 'Application',
      render: (r) => r.application_name,
    },
    {
      key: 'submitted',
      header: 'Submitted',
      render: (r) => formatDate(r.submitted_at),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (r) => (
        <div style={{ display: 'flex', gap: 6 }}>

          <button
            className="btn btn-sm btn-primary"
            disabled={approve.isPending && actionId === r.id}
            onClick={() => approve.mutate(r.id)}
          >
            {approve.isPending && actionId === r.id ? <span className="spinner" /> : <Check size={12} />}
            Approve
          </button>
          <button
            className="btn btn-sm btn-danger"
            onClick={() => { setRejectOpen(r.id); setRejectReason(''); }}
          >
            <X size={12} /> Reject
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Approval Queue"
        subtitle="Requests pending your decision"
        actions={
          <Link to="/supervisor/approvals/history" className="btn btn-secondary btn-sm">View History</Link>
        }
      />

      <div className="filters-bar">
        <div className="search-input-wrap">
          <Search size={14} />
          <input className="form-control" placeholder="Search requests…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {isError ? (
        <div className="error-state">
          <div className="error-state-title">Failed to load approvals</div>
          <button className="btn btn-secondary" onClick={() => refetch()}>Retry</button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          loading={isLoading}
          totalPages={data?.meta?.total_pages ?? 1}
          currentPage={page}
          total={data?.meta?.total}
          perPage={perPage}
          onPageChange={setPage}
          emptyTitle="No pending approvals"
          emptyDesc="All caught up! No requests are waiting for your review."
        />
      )}

      {/* Reject Modal */}
      {rejectOpen && (
        <div className="modal-overlay" onClick={() => setRejectOpen(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Reject Request</h2>
              <button className="btn-icon" onClick={() => setRejectOpen(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label required">Reason for rejection</label>
                <textarea
                  className="form-control"
                  placeholder="Explain why this request is being rejected…"
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setRejectOpen(null)}>Cancel</button>
              <button
                className="btn btn-danger"
                disabled={!rejectReason.trim() || reject.isPending}
                onClick={() => reject.mutate({ id: rejectOpen, reason: rejectReason })}
              >
                {reject.isPending ? <span className="spinner" /> : null}
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
