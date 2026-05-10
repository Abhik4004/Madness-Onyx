import { useSearchParams } from 'react-router-dom';

export function usePagination(defaultPerPage = 20) {
  const [searchParams, setSearchParams] = useSearchParams();

  const page = parseInt(searchParams.get('page') ?? '1', 10);

  const setPage = (newPage: number) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('page', String(newPage));
      return next;
    });
  };

  return { page, perPage: defaultPerPage, setPage };
}
