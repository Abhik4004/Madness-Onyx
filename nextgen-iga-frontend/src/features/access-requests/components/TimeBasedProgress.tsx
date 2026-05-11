import React, { useState, useEffect, useMemo } from 'react';
import { Clock } from 'lucide-react';

interface Props {
  decidedAt?: string | null;
  durationSeconds?: number | null;
  startTime?: string | null;
  endTime?: string | null;
  status: string;
}

export function TimeBasedProgress({ decidedAt, durationSeconds, startTime, endTime, status }: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    // Only update if active
    if (status !== 'APPROVED' && status !== 'PROVISIONED' && status !== 'ACTIVE') return;
    
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [status]);

  const { progress, remaining, isExpired } = useMemo(() => {
    const start = startTime ? new Date(startTime).getTime() : (decidedAt ? new Date(decidedAt).getTime() : null);
    const end = endTime ? new Date(endTime).getTime() : (start && durationSeconds ? start + (durationSeconds * 1000) : null);

    if (!start || !end) return { progress: 0, remaining: '', isExpired: status === 'EXPIRED' };
    
    // Only show progress for active statuses
    if (status !== 'APPROVED' && status !== 'PROVISIONED' && status !== 'ACTIVE' && status !== 'EXPIRED') {
       return { progress: 0, remaining: '', isExpired: false };
    }

    const total = end - start;
    const rem = end - now;
    const isActuallyExpired = rem <= 0;
    
    if (isActuallyExpired || status === 'EXPIRED') {
      return { progress: 0, remaining: 'Expired', isExpired: true };
    }

    const progress = Math.max(0, Math.min(100, (rem / total) * 100));
    
    // Format remaining time
    const seconds = Math.floor((rem / 1000) % 60);
    const minutes = Math.floor((rem / (1000 * 60)) % 60);
    const hours = Math.floor((rem / (1000 * 60 * 60)) % 24);
    const days = Math.floor(rem / (1000 * 60 * 60 * 24));

    let remainingStr = '';
    if (days > 0) remainingStr = `${days}d ${hours}h`;
    else if (hours > 0) remainingStr = `${hours}h ${minutes}m`;
    else if (minutes > 0) remainingStr = `${minutes}m ${seconds}s`;
    else remainingStr = `${seconds}s`;

    return { progress, remaining: remainingStr, isExpired: false };
  }, [decidedAt, durationSeconds, startTime, endTime, status, now]);

  if (!durationSeconds && !endTime) {
    return <span className="text-muted italic" style={{ fontSize: '0.85rem' }}>Permanent</span>;
  }

  return (
    <div className="time-progress-wrap" style={{ width: '120px' }}>
      <div className="time-progress-bar" style={{ 
        width: '100%', 
        height: '6px', 
        backgroundColor: 'var(--color-gray-100)', 
        borderRadius: '3px',
        overflow: 'hidden',
        marginBottom: '4px'
      }}>
        <div 
          className={`time-progress-fill`} 
          style={{ 
            width: `${progress}%`, 
            height: '100%',
            backgroundColor: isExpired ? 'var(--color-gray-400)' : 'var(--color-primary)',
            transition: 'width 1s linear'
          }} 
        />
      </div>
      <div className="time-progress-info" style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '4px',
        fontSize: '0.7rem',
        color: isExpired ? 'var(--color-gray-500)' : 'var(--color-primary)',
        fontWeight: 600
      }}>
        <Clock size={12} />
        <span>{isExpired ? 'EXPIRED' : remaining}</span>
      </div>
    </div>
  );
}
