import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AlertCircle, Loader2, MapPin, Package, RefreshCw, Route, Truck } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { QrCodePanel } from '@/components/QrCodePanel';
import { TrackingTimeline } from '@/components/TrackingTimeline';
import { useWarehouse } from '@/context/WarehouseContext';
import {
  journeyApi,
  type ParcelJourney, type ShipmentJourney,
} from '@/services/api';
import { ApiError } from '@/lib/apiClient';

type Kind = 'parcel' | 'shipment';

export default function Track() {
  const { kind, id } = useParams<{ kind: Kind; id: string }>();
  const { warehouses } = useWarehouse();

  const [parcel, setParcel] = useState<ParcelJourney | null>(null);
  const [shipment, setShipment] = useState<ShipmentJourney | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const whName = (whId?: string) => warehouses.find(w => w.id === whId)?.name ?? whId ?? '—';
  const whCity = (whId?: string) => warehouses.find(w => w.id === whId)?.city ?? '';

  const load = useCallback(async () => {
    if (!id || (kind !== 'parcel' && kind !== 'shipment')) {
      setError('Invalid tracking link');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setParcel(null);
    setShipment(null);
    try {
      if (kind === 'parcel') {
        const res = await journeyApi.getParcelJourney(id);
        setParcel(res.data);
      } else {
        const res = await journeyApi.getShipmentJourney(id);
        setShipment(res.data);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setError(kind === 'parcel' ? 'No parcel found with this ID' : 'No shipment found with this number');
      } else {
        setError(err instanceof ApiError ? err.message : 'Failed to load tracking info');
      }
    } finally {
      setLoading(false);
    }
  }, [kind, id]);

  useEffect(() => { void load(); }, [load]);

  const trackUrl = typeof window !== 'undefined' ? window.location.href : '';

  return (
    <Layout>
      <PageHeader
        title={kind === 'shipment' ? 'Track Shipment' : 'Track Parcel'}
        subtitle={id}
        backTo="/dashboard"
      />

      <div className="max-w-2xl mx-auto space-y-6">
        {loading && (
          <div className="flex items-center justify-center gap-2 text-muted-foreground p-12">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading…
          </div>
        )}

        {!loading && error && (
          <div className="text-center p-10 border border-dashed rounded-xl space-y-3">
            <AlertCircle className="w-8 h-8 mx-auto text-destructive" />
            <p className="text-muted-foreground">{error}</p>
            <Button variant="outline" onClick={() => void load()}>
              <RefreshCw className="w-4 h-4 mr-2" /> Try again
            </Button>
          </div>
        )}

        {!loading && !error && parcel && (
          <>
            <div className="bg-card border rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <Package className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Parcel</p>
                    <p className="font-mono font-bold text-sm break-all">{parcel.parcelId}</p>
                  </div>
                </div>
                <StatusBadge status={parcel.currentStatus} />
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Origin</p>
                  <p className="font-medium">{whName(parcel.originWarehouseId)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Destination</p>
                  <p className="font-medium">{whName(parcel.destinationWarehouseId)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Currently at</p>
                  <p className="font-medium">{whName(parcel.currentWarehouseId)}</p>
                </div>
              </div>
            </div>

            <QrCodePanel value={trackUrl} label={parcel.parcelId} title="Parcel QR" />

            <div className="bg-card border rounded-xl p-6">
              <h2 className="font-semibold flex items-center gap-2 mb-4">
                <Route className="w-4 h-4" /> Journey
              </h2>
              <TrackingTimeline timeline={parcel.timeline} />
            </div>
          </>
        )}

        {!loading && !error && shipment && (
          <>
            <div className="bg-card border rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <Truck className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Shipment</p>
                    <p className="font-mono font-bold text-sm">{shipment.shipmentNo}</p>
                  </div>
                </div>
                <StatusBadge status={shipment.currentStatus} />
              </div>
              <div className="flex items-center gap-2 text-sm p-3 bg-secondary rounded-lg">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{shipment.originCity ?? '—'}</span>
                <span className="text-muted-foreground">→</span>
                <span className="font-medium">{shipment.destinationCity ?? '—'}</span>
              </div>
            </div>

            <QrCodePanel value={trackUrl} label={shipment.shipmentNo} title="Shipment QR" />

            {shipment.legs.length > 0 && (
              <div className="bg-card border rounded-xl p-6">
                <h2 className="font-semibold mb-3">Legs</h2>
                <div className="space-y-2">
                  {shipment.legs.map(leg => (
                    <div key={leg.sequence} className="flex items-center justify-between text-sm bg-muted/30 rounded px-3 py-2">
                      <span>{leg.fromCity} → {leg.toCity}</span>
                      <span className="text-xs text-muted-foreground">{leg.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-card border rounded-xl p-6">
              <h2 className="font-semibold flex items-center gap-2 mb-4">
                <Route className="w-4 h-4" /> Journey
              </h2>
              <TrackingTimeline timeline={shipment.timeline} />
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
