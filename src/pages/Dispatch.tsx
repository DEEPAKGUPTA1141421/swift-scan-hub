import { useState, useEffect, useCallback } from 'react';
import { Truck, Package, MapPin, Hash, User, CheckCircle, Loader2, RefreshCw } from 'lucide-react';
import { useWarehouse } from '@/context/WarehouseContext';
import { Layout } from '@/components/Layout';
import { PageHeader } from '@/components/PageHeader';
import { ScanInput } from '@/components/ScanInput';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Parcel } from '@/types/warehouse';
import { vehicleApi, VehicleSummary } from '@/services/api';
import { ApiError } from '@/lib/apiClient';
import { toast } from 'sonner';

export default function Dispatch() {
  const [scannedParcel, setScannedParcel] = useState<Parcel | null>(null);
  const [riderId, setRiderId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [vehicles, setVehicles] = useState<VehicleSummary[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [dispatched, setDispatched] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);

  const { getParcelByQr, dispatchParcel, currentWarehouse, refreshData } = useWarehouse();

  const loadVehicles = useCallback(async () => {
    if (!currentWarehouse?.id) return;
    setVehiclesLoading(true);
    try {
      const res = await vehicleApi.getAvailable(currentWarehouse.id);
      setVehicles(res.data ?? []);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load vehicles');
    } finally {
      setVehiclesLoading(false);
    }
  }, [currentWarehouse?.id]);

  useEffect(() => { loadVehicles(); }, [loadVehicles]);

  const handleScan = async (qrCode: string) => {
    setIsLookingUp(true);
    try {
      // Try local state first (fast path)
      const local = getParcelByQr(qrCode);
      if (local) {
        if (local.currentWarehouse !== currentWarehouse?.city) {
          toast.error(`Shipment belongs to ${local.currentWarehouse}, not this warehouse`);
          return;
        }
        if (local.status !== 'READY_TO_DISPATCH') {
          toast.error(`Shipment status is ${local.status} — must be READY_TO_DISPATCH`);
          return;
        }
        setScannedParcel(local);
        setDispatched(false);
        toast.success('Shipment found');
        return;
      }

      // Fallback: refresh warehouse data and try again
      await refreshData();
      const refreshed = getParcelByQr(qrCode);
      if (!refreshed) {
        toast.error('Shipment not found');
        return;
      }
      if (refreshed.status !== 'READY_TO_DISPATCH') {
        toast.error(`Shipment status is ${refreshed.status} — must be READY_TO_DISPATCH`);
        return;
      }
      setScannedParcel(refreshed);
      setDispatched(false);
      toast.success('Shipment found');
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleDispatch = async () => {
    if (!scannedParcel) return;
    if (!riderId && !vehicleId) {
      toast.error('Enter a Rider ID or pick a Vehicle');
      return;
    }

    setIsDispatching(true);
    const result = await dispatchParcel(scannedParcel.id, riderId, vehicleId);
    setIsDispatching(false);

    if (result.success) {
      setShowConfirm(false);
      setDispatched(true);
      if (result.error) {
        toast.warning(result.error);
      } else {
        toast.success('Shipment dispatched successfully');
      }
    } else {
      toast.error(result.error ?? 'Failed to dispatch');
    }
  };

  const handleReset = () => {
    setScannedParcel(null);
    setRiderId('');
    setVehicleId('');
    setDispatched(false);
  };

  return (
    <Layout>
      <PageHeader
        title="Dispatch Shipment"
        subtitle="Send shipments to riders or vehicles"
        backTo="/dashboard"
      />

      <div className="max-w-xl mx-auto space-y-8">
        {!dispatched && (
          <ScanInput
            onScan={qr => void handleScan(qr)}
            placeholder="Scan Shipment QR / UUID"
            disabled={isLookingUp}
          />
        )}

        {isLookingUp && (
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Looking up shipment…</span>
          </div>
        )}

        {scannedParcel && !dispatched && (
          <div className="bg-card border border-border rounded-xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Package className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Shipment ID</p>
                  <p className="text-lg font-bold font-mono">{scannedParcel.id.slice(0, 8)}…</p>
                </div>
              </div>
              <StatusBadge status={scannedParcel.status} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-secondary rounded-lg">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <MapPin className="w-4 h-4" />
                  <span className="text-sm">Destination</span>
                </div>
                <p className="font-bold text-lg">{scannedParcel.destinationCity}</p>
              </div>
              <div className="p-4 bg-secondary rounded-lg">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Hash className="w-4 h-4" />
                  <span className="text-sm">Orders</span>
                </div>
                <p className="font-bold text-lg">{scannedParcel.orders.length}</p>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-border">
              <div className="space-y-2">
                <Label htmlFor="rider" className="text-base flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Rider ID
                </Label>
                <Input
                  id="rider"
                  value={riderId}
                  onChange={e => setRiderId(e.target.value.toUpperCase())}
                  placeholder="e.g., rider UUID or RDR-001"
                  className="h-12 text-base uppercase"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vehicle" className="text-base flex items-center gap-2">
                  <Truck className="w-4 h-4" />
                  Vehicle
                </Label>
                <div className="flex gap-2">
                  <Select value={vehicleId} onValueChange={setVehicleId} disabled={vehiclesLoading}>
                    <SelectTrigger id="vehicle" className="h-12 text-base flex-1">
                      <SelectValue placeholder={vehiclesLoading ? 'Loading vehicles…' : 'Select a vehicle (optional)'} />
                    </SelectTrigger>
                    <SelectContent>
                      {vehicles.map(v => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.vehicleNumber} · {v.vehicleType} · {v.capacityKg}kg
                        </SelectItem>
                      ))}
                      {vehicles.length === 0 && !vehiclesLoading && (
                        <SelectItem value="_none" disabled>No available vehicles</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button" variant="outline" size="icon" className="h-12 w-12 shrink-0"
                    onClick={loadVehicles} disabled={vehiclesLoading}
                  >
                    <RefreshCw className={`w-4 h-4 ${vehiclesLoading ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>
            </div>

            <Button
              onClick={() => setShowConfirm(true)}
              disabled={(!riderId && !vehicleId) || isDispatching}
              className="w-full h-14 text-lg font-semibold"
            >
              <Truck className="w-6 h-6 mr-2" />
              Dispatch Shipment
            </Button>
          </div>
        )}

        {dispatched && (
          <div className="bg-success/10 border-2 border-success rounded-xl p-8 text-center space-y-6">
            <div className="inline-flex p-4 bg-success rounded-full">
              <CheckCircle className="w-12 h-12 text-success-foreground" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-success">Dispatched!</h2>
              <p className="text-muted-foreground mt-2">
                Shipment dispatched to {scannedParcel?.destinationCity}
              </p>
            </div>
            <Button onClick={handleReset} variant="outline" className="h-12 px-8">
              Dispatch Another
            </Button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        title="Confirm Dispatch"
        description={`Dispatch shipment with ${scannedParcel?.orders.length} orders to ${scannedParcel?.destinationCity}?`}
        confirmLabel={isDispatching ? 'Dispatching…' : 'Dispatch'}
        onConfirm={() => void handleDispatch()}
      />
    </Layout>
  );
}
