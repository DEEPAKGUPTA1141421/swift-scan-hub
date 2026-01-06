import { cn } from '@/lib/utils';

type Status = 'PENDING' | 'RECEIVED' | 'IN_PARCEL' | 'DISPATCHED' | 'OPEN' | 'READY_TO_DISPATCH';

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

const statusConfig: Record<Status, { label: string; className: string }> = {
  PENDING: { label: 'Pending', className: 'bg-muted text-muted-foreground' },
  RECEIVED: { label: 'Received', className: 'bg-success/15 text-success border border-success/30' },
  IN_PARCEL: { label: 'In Parcel', className: 'bg-accent/15 text-accent border border-accent/30' },
  DISPATCHED: { label: 'Dispatched', className: 'bg-primary/15 text-primary border border-primary/30' },
  OPEN: { label: 'Open', className: 'bg-warning/15 text-warning-foreground border border-warning/30' },
  READY_TO_DISPATCH: { label: 'Ready', className: 'bg-success/15 text-success border border-success/30' },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  
  return (
    <span className={cn(
      'inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold',
      config.className,
      className
    )}>
      {config.label}
    </span>
  );
}
