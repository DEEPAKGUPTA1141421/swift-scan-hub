import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { LiveRider } from '@/types/warehouse';
import { Badge } from '@/components/ui/badge';

interface Props {
  rider: LiveRider;
}

/** Creates an arrow-shaped div marker rotated to the rider's heading. */
function makeRiderIcon(heading: number, isMoving: boolean) {
  const color = isMoving ? '#22c55e' : '#f59e0b'; // green moving, amber idle
  return L.divIcon({
    className: '',
    html: `<div style="
      width: 32px; height: 32px;
      background: ${color};
      border: 3px solid white;
      border-radius: 50% 50% 50% 0;
      transform: rotate(${heading - 45}deg);
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
    "></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

export function RiderMarker({ rider }: Props) {
  const isMoving = rider.speedKmh > 1;
  const icon = makeRiderIcon(rider.heading, isMoving);
  const progress = rider.totalStops > 0
    ? Math.round((rider.completedStops / rider.totalStops) * 100)
    : 0;

  return (
    <Marker position={[rider.lat, rider.lng]} icon={icon}>
      <Popup minWidth={220} maxWidth={280}>
        <div className="space-y-2 py-1">
          {/* Header */}
          <div className="flex items-center justify-between gap-2">
            <p className="font-bold text-sm truncate">
              {rider.riderName ?? rider.riderId.slice(0, 8) + '…'}
            </p>
            <Badge variant={isMoving ? 'default' : 'secondary'} className="text-xs shrink-0">
              {isMoving ? `${Math.round(rider.speedKmh)} km/h` : 'Idle'}
            </Badge>
          </div>

          {/* Progress */}
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Progress</span>
              <span>{rider.completedStops}/{rider.totalStops} stops</span>
            </div>
            <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Stop list */}
          {rider.stops.length > 0 && (
            <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
              {rider.stops.map(stop => (
                <div key={stop.assignmentId}
                  className="flex items-start gap-2 text-xs py-0.5">
                  <span className={`
                    shrink-0 w-5 h-5 rounded-full flex items-center justify-center
                    font-bold text-[10px] mt-0.5
                    ${stop.status === 'DELIVERED' ? 'bg-green-100 text-green-700' :
                      stop.status === 'FAILED'    ? 'bg-red-100 text-red-700' :
                      stop.status === 'PICKED'    ? 'bg-blue-100 text-blue-700' :
                                                    'bg-muted text-muted-foreground'}
                  `}>
                    {stop.sequenceNumber}
                  </span>
                  <span className={`leading-tight ${
                    stop.status === 'DELIVERED' ? 'line-through text-muted-foreground' : ''
                  }`}>
                    {stop.destAddress}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Popup>
    </Marker>
  );
}
