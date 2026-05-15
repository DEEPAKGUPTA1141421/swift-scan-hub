import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  // Order statuses
  PENDING: { label: 'Pending', className: 'bg-muted text-muted-foreground' },
  RECEIVED: { label: 'Received', className: 'bg-success/15 text-success border border-success/30' },
  IN_PARCEL: { label: 'In Parcel', className: 'bg-accent/15 text-accent border border-accent/30' },
  DISPATCHED: { label: 'Dispatched', className: 'bg-primary/15 text-primary border border-primary/30' },
  OPEN: { label: 'Open', className: 'bg-warning/15 text-warning-foreground border border-warning/30' },
  READY_TO_DISPATCH: { label: 'Ready', className: 'bg-success/15 text-success border border-success/30' },
  // Order statuses (backend OrderStatus enum)
  PICKUP_SCHEDULED: { label: 'Pickup Scheduled', className: 'bg-amber-500/15 text-amber-700 border border-amber-500/30' },
  PICKED: { label: 'Picked', className: 'bg-sky-500/15 text-sky-700 border border-sky-500/30' },
  WAREHOUSE: { label: 'At Warehouse', className: 'bg-primary/15 text-primary border border-primary/30' },
  // Shipment-only statuses
  ASSIGNED: { label: 'Assigned', className: 'bg-amber-500/15 text-amber-700 border border-amber-500/30' },
  PICKED_UP: { label: 'Picked Up', className: 'bg-sky-500/15 text-sky-700 border border-sky-500/30' },
  ARRIVED: { label: 'Arrived', className: 'bg-success/15 text-success border border-success/30' },
  CANCELLED: { label: 'Cancelled', className: 'bg-destructive/15 text-destructive border border-destructive/30' },
  // Parcel statuses
  CREATED: { label: 'Created', className: 'bg-muted text-muted-foreground border border-border' },
  AWAITING_PICKUP: { label: 'Awaiting Pickup', className: 'bg-warning/15 text-warning-foreground border border-warning/30' },
  PICKED_BY_RIDER: { label: 'Picked Up', className: 'bg-accent/15 text-accent border border-accent/30' },
  AT_WAREHOUSE: { label: 'At Warehouse', className: 'bg-primary/15 text-primary border border-primary/30' },
  IN_SHIPMENT: { label: 'In Shipment', className: 'bg-primary/15 text-primary border border-primary/30' },
  IN_TRANSIT: { label: 'In Transit', className: 'bg-accent/15 text-accent border border-accent/30' },
  AT_DEST_WAREHOUSE: { label: 'At Destination', className: 'bg-primary/15 text-primary border border-primary/30' },
  OUT_FOR_DELIVERY: { label: 'Out for Delivery', className: 'bg-warning/15 text-warning-foreground border border-warning/30' },
  DELIVERED: { label: 'Delivered', className: 'bg-success/15 text-success border border-success/30' },
  RETURNED: { label: 'Returned', className: 'bg-destructive/15 text-destructive border border-destructive/30' },
  FAILED: { label: 'Failed', className: 'bg-destructive/15 text-destructive border border-destructive/30' },
};

const fallbackConfig = { label: (s: string) => s.replace(/_/g, ' '), className: 'bg-muted text-muted-foreground' };

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span className={cn(
      'inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold',
      config ? config.className : fallbackConfig.className,
      className
    )}>
      {config ? config.label : fallbackConfig.label(status)}
    </span>
  );
}
