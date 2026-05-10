import { Circle, Polygon, Popup } from 'react-leaflet';
import type { ServiceZone } from '@/types/zone';
import { Badge } from '@/components/ui/badge';

interface Props {
  zones: ServiceZone[];
  selectedId?: string;
  onSelect?: (zone: ServiceZone) => void;
}

const TARGET_COLORS: Record<string, string> = {
  USER:   '#6366f1', // indigo
  SELLER: '#f59e0b', // amber
  BOTH:   '#22c55e', // green
};

function zoneColor(zone: ServiceZone) {
  if (zone.status === 'INACTIVE') return '#6b7280'; // gray
  return TARGET_COLORS[zone.target] ?? '#6366f1';
}

export function ZoneLayer({ zones, selectedId, onSelect }: Props) {
  return (
    <>
      {zones.map(zone => {
        const color = zoneColor(zone);
        const weight = zone.id === selectedId ? 3 : 1.5;
        const opacity = zone.status === 'INACTIVE' ? 0.35 : 0.85;
        const fillOpacity = zone.id === selectedId ? 0.25 : 0.12;

        const popup = (
          <Popup minWidth={200}>
            <div className="space-y-1.5 py-1 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold">{zone.name}</span>
                <Badge
                  variant={zone.status === 'ACTIVE' ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  {zone.status}
                </Badge>
              </div>
              <p className="text-muted-foreground text-xs">{zone.city}</p>
              <div className="flex gap-1.5 flex-wrap">
                <Badge variant="outline" className="text-xs">{zone.shapeType}</Badge>
                <Badge variant="outline" className="text-xs">{zone.target}</Badge>
                {zone.shapeType === 'CIRCLE' && (
                  <Badge variant="outline" className="text-xs">
                    r={zone.radiusMeters}m
                  </Badge>
                )}
              </div>
              {zone.description && (
                <p className="text-muted-foreground text-xs">{zone.description}</p>
              )}
              {onSelect && (
                <button
                  onClick={() => onSelect(zone)}
                  className="mt-1 text-xs text-primary underline-offset-2 hover:underline"
                >
                  Edit zone
                </button>
              )}
            </div>
          </Popup>
        );

        if (zone.shapeType === 'CIRCLE' && zone.centerLat != null && zone.centerLng != null) {
          return (
            <Circle
              key={zone.id}
              center={[zone.centerLat, zone.centerLng]}
              radius={zone.radiusMeters ?? 1000}
              pathOptions={{ color, weight, opacity, fillOpacity, fillColor: color }}
              eventHandlers={{ click: () => onSelect?.(zone) }}
            >
              {popup}
            </Circle>
          );
        }

        if (zone.shapeType === 'POLYGON' && zone.polygonPoints?.length) {
          const positions = zone.polygonPoints.map(
            p => [p.lat, p.lng] as [number, number]
          );
          return (
            <Polygon
              key={zone.id}
              positions={positions}
              pathOptions={{ color, weight, opacity, fillOpacity, fillColor: color }}
              eventHandlers={{ click: () => onSelect?.(zone) }}
            >
              {popup}
            </Polygon>
          );
        }

        return null;
      })}
    </>
  );
}
