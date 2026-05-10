import { useEffect } from 'react';
import { MapContainer, TileLayer, useMapEvents, Marker, Polyline, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { LatLngPoint } from '@/types/zone';
import { ZoneLayer } from './ZoneLayer';
import type { ServiceZone } from '@/types/zone';

interface Props {
  mode: 'CIRCLE' | 'POLYGON' | 'VIEW';
  // CIRCLE
  centerLat?: number;
  centerLng?: number;
  radiusMeters?: number;
  // POLYGON
  polygonPoints?: LatLngPoint[];
  onPointAdded?: (p: LatLngPoint) => void;
  onCenterSet?: (p: LatLngPoint) => void;
  // Existing zones for context
  existingZones?: ServiceZone[];
  selectedZoneId?: string;
}

/** Dot icon for polygon vertices */
const dotIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:10px;height:10px;background:#6366f1;
    border:2px solid white;border-radius:50%;
    box-shadow:0 1px 4px rgba(0,0,0,.4)
  "></div>`,
  iconSize: [10, 10],
  iconAnchor: [5, 5],
});

const centerIcon = L.divIcon({
  className: '',
  html: `<div style="
    width:14px;height:14px;background:#f59e0b;
    border:2.5px solid white;border-radius:50%;
    box-shadow:0 1px 4px rgba(0,0,0,.5)
  "></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

/** Listens to map clicks and fires callbacks. */
function ClickCapture({
  mode,
  onPointAdded,
  onCenterSet,
}: Pick<Props, 'mode' | 'onPointAdded' | 'onCenterSet'>) {
  useMapEvents({
    click(e) {
      const p: LatLngPoint = { lat: e.latlng.lat, lng: e.latlng.lng };
      if (mode === 'POLYGON') onPointAdded?.(p);
      if (mode === 'CIRCLE')  onCenterSet?.(p);
    },
  });
  return null;
}

/** Keeps the map view centred on the drawn shape. */
function AutoCenter({ lat, lng }: { lat?: number; lng?: number }) {
  const map = useMapEvents({});
  useEffect(() => {
    if (lat != null && lng != null) {
      map.setView([lat, lng], Math.max(map.getZoom(), 13));
    }
  }, [lat, lng, map]);
  return null;
}

export function ZoneDrawMap({
  mode,
  centerLat, centerLng, radiusMeters,
  polygonPoints = [],
  onPointAdded,
  onCenterSet,
  existingZones = [],
  selectedZoneId,
}: Props) {
  const defaultCenter: [number, number] = [28.6139, 77.209]; // Delhi

  return (
    <MapContainer
      center={defaultCenter}
      zoom={11}
      className="w-full h-full"
      style={{ minHeight: '100%', cursor: mode !== 'VIEW' ? 'crosshair' : 'grab' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Existing zones as faded overlays */}
      <ZoneLayer
        zones={existingZones.filter(z => z.id !== selectedZoneId)}
        selectedId={selectedZoneId}
      />

      {/* Click capture */}
      <ClickCapture mode={mode} onPointAdded={onPointAdded} onCenterSet={onCenterSet} />

      {/* Auto-center on drawn shape */}
      <AutoCenter lat={centerLat ?? polygonPoints[0]?.lat} lng={centerLng ?? polygonPoints[0]?.lng} />

      {/* CIRCLE preview */}
      {mode === 'CIRCLE' && centerLat != null && centerLng != null && (
        <>
          <Circle
            center={[centerLat, centerLng]}
            radius={radiusMeters ?? 500}
            pathOptions={{
              color: '#f59e0b', weight: 2,
              fillColor: '#f59e0b', fillOpacity: 0.18,
            }}
          />
          <Marker position={[centerLat, centerLng]} icon={centerIcon} />
        </>
      )}

      {/* POLYGON preview */}
      {mode === 'POLYGON' && polygonPoints.length > 0 && (
        <>
          {polygonPoints.length >= 2 && (
            <Polyline
              positions={[
                ...polygonPoints.map(p => [p.lat, p.lng] as [number, number]),
                // close the shape preview
                ...(polygonPoints.length >= 3
                  ? [[polygonPoints[0].lat, polygonPoints[0].lng] as [number, number]]
                  : []),
              ]}
              pathOptions={{ color: '#6366f1', weight: 2, dashArray: '6 4' }}
            />
          )}
          {polygonPoints.map((p, i) => (
            <Marker key={i} position={[p.lat, p.lng]} icon={dotIcon} />
          ))}
        </>
      )}
    </MapContainer>
  );
}
