import { format, formatDistanceToNow } from 'date-fns';
import type { ApiError } from '../types/api.types';

export function formatDate(dateString?: string | null): string {
  if (!dateString) return 'N/A';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return 'Invalid date';
  return format(d, 'MMM d, yyyy');
}

export function formatDateTime(dateString?: string | null): string {
  if (!dateString) return 'N/A';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return 'Invalid date';
  return format(d, 'MMM d, yyyy h:mm a');
}

export function formatRelative(dateString?: string | null): string {
  if (!dateString) return 'N/A';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return 'Invalid date';
  return formatDistanceToNow(d, { addSuffix: true });
}

export function mapApiErrors(
  errors: ApiError[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setError: (field: any, error: { message: string }) => void
) {
  errors.forEach((e) => setError(e.field, { message: e.message }));
}

export function getErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const axiosError = error as {
      response?: { data?: { message?: string } };
    };
    return axiosError.response?.data?.message ?? 'An error occurred';
  }
  return 'An error occurred';
}
