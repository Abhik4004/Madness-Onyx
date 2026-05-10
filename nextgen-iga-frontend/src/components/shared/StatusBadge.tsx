interface Props {
  status: string;
}

export function StatusBadge({ status }: Props) {
  const cls = `badge badge-${status.toLowerCase().replace(/ /g, '_')}`;
  return <span className={cls}>{status.replace(/_/g, ' ')}</span>;
}
