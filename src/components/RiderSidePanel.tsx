import { useState } from 'react';
import { ChevronDown, ChevronRight, Circle, CheckCircle2, XCircle, Bike } from 'lucide-react';
import { LiveRider, AssignmentStop } from '@/types/warehouse';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface Props {
  riders: LiveRider[];
}

export function RiderSidePanel({ riders }: Props) {
  if (riders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground p-6">
        <Bike className="w-10 h-10 opacity-40" />
        <p className="text-sm text-center">No active riders yet. Trigger a VRP batch to assign orders.</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-2 p-3">
        {riders.map(rider => (
          <RiderCard key={rider.riderId} rider={rider} />
        ))}
      </div>
    </ScrollArea>
  );
}

function RiderCard({ rider }: { rider: LiveRider }) {
  const [expanded, setExpanded] = useState(false);
  const progress = rider.totalStops > 0
    ? Math.round((rider.completedStops / rider.totalStops) * 100)
    : 0;
  const isMoving = rider.speedKmh > 1;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Card header — always visible */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full text-left p-3 flex items-center gap-3 hover:bg-accent/40 transition-colors"
      >
        {/* Avatar */}
        <div className="relative shrink-0">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
            <Bike className="w-4 h-4 text-primary" />
          </div>
          <span className={cn(
            'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card',
            isMoving ? 'bg-green-500' : 'bg-amber-400'
          )} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">
            {rider.riderName ?? `Rider ${rider.riderId.slice(0, 6)}`}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            {/* Progress bar */}
            <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground shrink-0">
              {rider.completedStops}/{rider.totalStops}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Badge variant="outline" className="text-xs hidden sm:flex">
            {isMoving ? `${Math.round(rider.speedKmh)} km/h` : 'Idle'}
          </Badge>
          {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {/* Collapsible stop list */}
      {expanded && rider.stops.length > 0 && (
        <div className="border-t border-border divide-y divide-border">
          {rider.stops.map(stop => (
            <StopRow key={stop.assignmentId} stop={stop} />
          ))}
        </div>
      )}

      {expanded && rider.stops.length === 0 && (
        <p className="text-xs text-muted-foreground px-3 py-2 border-t border-border">
          No stops loaded yet
        </p>
      )}
    </div>
  );
}

function StopRow({ stop }: { stop: AssignmentStop }) {
  return (
    <div className="flex items-start gap-2.5 px-3 py-2.5">
      <StopStatusIcon status={stop.status} seq={stop.sequenceNumber} />
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-xs leading-snug',
          stop.status === 'DELIVERED' && 'line-through text-muted-foreground'
        )}>
          {stop.destAddress}
        </p>
        <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{stop.orderNo}</p>
      </div>
      <Badge variant={
        stop.status === 'DELIVERED' ? 'default' :
        stop.status === 'FAILED'    ? 'destructive' :
        stop.status === 'PICKED'    ? 'secondary' : 'outline'
      } className="text-[10px] shrink-0 self-start mt-0.5">
        {stop.status}
      </Badge>
    </div>
  );
}

function StopStatusIcon({ status, seq }: { status: string; seq: number }) {
  if (status === 'DELIVERED') return <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />;
  if (status === 'FAILED')    return <XCircle      className="w-4 h-4 text-red-500   shrink-0 mt-0.5" />;
  return (
    <span className="w-4 h-4 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
      {seq}
    </span>
  );
}
