import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { AssignmentStop } from '@/types/warehouse';
import { Badge } from '@/components/ui/badge';

interface Props {
  stop: AssignmentStop;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  ASSIGNED:  { bg: '#6366f1', text: 'white' },
  PICKED:    { bg: '#3b82f6', text: 'white' },
  DELIVERED: { bg: '#22c55e', text: 'white' },
  FAILED:    { bg: '#ef4444', text: 'white' },
};

/** Numbered circle pin — color reflects stop status. */
function makeStopIcon(sequenceNumber: number, status: string) {
  const { bg, text } = STATUS_COLORS[status] ?? { bg: '#6366f1', text: 'white' };
  return L.divIcon({
    className: '',
    html: `<div style="
      width: 28px; height: 28px;
      background: ${bg};
      color: ${text};
      border: 2.5px solid white;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 700;
      box-shadow: 0 2px 6px rgba(0,0,0,0.35);
    ">${sequenceNumber}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

export function OrderStopPin({ stop }: Props) {
  const icon = makeStopIcon(stop.sequenceNumber, stop.status);

  return (
    <Marker position={[stop.destLat, stop.destLng]} icon={icon}>
      <Popup minWidth={200}>
        <div className="space-y-1.5 py-1 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold">Stop #{stop.sequenceNumber}</span>
            <Badge variant={
              stop.status === 'DELIVERED' ? 'default' :
              stop.status === 'FAILED'    ? 'destructive' : 'secondary'
            } className="text-xs">
              {stop.status}
            </Badge>
          </div>
          <p className="text-muted-foreground text-xs leading-snug">{stop.destAddress}</p>
          <p className="text-xs font-mono text-muted-foreground">{stop.orderNo}</p>
        </div>
      </Popup>
    </Marker>
  );
}
