import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LiveRider } from '@/types/warehouse';
import { RiderMarker } from './RiderMarker';
import { OrderStopPin } from './OrderStopPin';

// Fix Leaflet default icon paths broken by Vite asset hashing
delete (L.Icon.Default.prototype as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface Props {
  riders: LiveRider[];
  warehouseLat?: number;
  warehouseLng?: number;
}

/** Auto-fits map view whenever riders change. */
function AutoFit({ riders }: { riders: LiveRider[] }) {
  const map = useMap();
  useEffect(() => {
    const points = riders
      .filter(r => r.lat !== 0 && r.lng !== 0)
      .flatMap(r => [
        [r.lat, r.lng] as L.LatLngTuple,
        ...r.stops
          .filter(s => s.destLat !== 0 && s.destLng !== 0)
          .map(s => [s.destLat, s.destLng] as L.LatLngTuple),
      ]);
    if (points.length > 0) {
      map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 15 });
    }
  }, [riders, map]);
  return null;
}

export function MapPanel({ riders, warehouseLat = 28.6139, warehouseLng = 77.209 }: Props) {
  const allStops = riders.flatMap(r => r.stops);

  return (
    <MapContainer
      center={[warehouseLat, warehouseLng]}
      zoom={12}
      className="w-full h-full rounded-xl overflow-hidden"
      style={{ minHeight: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <AutoFit riders={riders} />

      {/* Order stop pins — rendered first so rider markers sit on top */}
      {allStops.map(stop => (
        <OrderStopPin key={stop.assignmentId} stop={stop} />
      ))}

      {/* Rider arrow markers */}
      {riders.map(rider => (
        <RiderMarker key={rider.riderId} rider={rider} />
      ))}
    </MapContainer>
  );
}
