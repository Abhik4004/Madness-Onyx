import { type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react';
import { EmptyState } from './EmptyState';

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  render: (row: T) => ReactNode;
  width?: string;
}

interface Props<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  totalPages?: number;
  currentPage?: number;
  total?: number;
  perPage?: number;
  onPageChange?: (page: number) => void;
  sortKey?: string;
  sortDir?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  emptyTitle?: string;
  emptyDesc?: string;
  emptyAction?: ReactNode;
}

function SkeletonRows({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j}>
              <div className="skeleton skeleton-text" style={{ width: `${60 + Math.random() * 30}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function DataTable<T>({
  columns,
  data,
  loading,
  totalPages = 1,
  currentPage = 1,
  total,
  perPage,
  onPageChange,
  sortKey,
  sortDir,
  onSort,
  emptyTitle = 'No data found',
  emptyDesc,
  emptyAction,
}: Props<T>) {
  const showPagination = totalPages > 1 || (total !== undefined);

  const pageNumbers = () => {
    const pages: (number | '...')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={col.sortable ? 'sortable' : ''}
                  style={col.width ? { width: col.width } : undefined}
                  onClick={col.sortable && onSort ? () => onSort(col.key) : undefined}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {col.header}
                    {col.sortable && sortKey === col.key && (
                      sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonRows cols={columns.length} />
            ) : (data ?? []).length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  <EmptyState title={emptyTitle} description={emptyDesc} action={emptyAction} />
                </td>
              </tr>
            ) : (
              (data ?? []).map((row, i) => (
                <tr key={i}>
                  {columns.map((col) => (
                    <td key={col.key}>{col.render(row)}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showPagination && (
        <div className="pagination">
          <div className="pagination-info">
            {total !== undefined && perPage !== undefined
              ? `Showing ${Math.min((currentPage - 1) * perPage + 1, total)}–${Math.min(currentPage * perPage, total)} of ${total}`
              : `Page ${currentPage} of ${totalPages}`}
          </div>
          <div className="pagination-controls">
            <button
              className="page-btn"
              disabled={currentPage <= 1 || loading}
              onClick={() => onPageChange?.(currentPage - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft size={14} />
            </button>
            {pageNumbers().map((p, i) =>
              p === '...' ? (
                <span key={`e${i}`} style={{ padding: '0 4px', color: 'var(--color-gray-400)' }}>…</span>
              ) : (
                <button
                  key={p}
                  className={`page-btn ${p === currentPage ? 'active' : ''}`}
                  onClick={() => onPageChange?.(p)}
                  disabled={loading}
                >
                  {p}
                </button>
              )
            )}
            <button
              className="page-btn"
              disabled={currentPage >= totalPages || loading}
              onClick={() => onPageChange?.(currentPage + 1)}
              aria-label="Next page"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
