import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Package, PackagePlus, X, Check, MapPin, Loader2 } from 'lucide-react';
import { useWarehouse } from '@/context/WarehouseContext';
import { Layout } from '@/components/Layout';
import { PageHeader } from '@/components/PageHeader';
import { ScanInput } from '@/components/ScanInput';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Parcel } from '@/types/warehouse';
import { toast } from 'sonner';

export default function CreateParcel() {
  const [searchParams] = useSearchParams();
  const [selectedDestination, setSelectedDestination] = useState(searchParams.get('destination') || '');
  const [activeParcel, setActiveParcel] = useState<Parcel | null>(null);
  const [scannedOrders, setScannedOrders] = useState<string[]>([]);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const navigate = useNavigate();

  const {
    createParcel,
    addOrderToParcel,
    closeParcel,
    getOrderByQr,
    orders,
    currentWarehouse,
    warehouses,
  } = useWarehouse();

  const initialOrderId = searchParams.get('orderId');

  // Available destinations: all warehouses except current
  const availableWarehouses = warehouses.filter(w => w.city !== currentWarehouse?.city);

  useEffect(() => {
    if (initialOrderId && selectedDestination && !activeParcel) {
      void handleCreateParcel();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateParcel = async () => {
    if (!selectedDestination) {
      toast.error('Please select a destination city');
      return;
    }

    setIsCreating(true);
    try {
      const parcel = await createParcel(selectedDestination);
      setActiveParcel(parcel);
      setScannedOrders([]);
      toast.success(`Shipment ${parcel.id.slice(0, 8)}… created`);

      if (initialOrderId) {
        setTimeout(() => void handleScanOrder(initialOrderId), 100);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create shipment';
      toast.error(msg);
    } finally {
      setIsCreating(false);
    }
  };

  const handleScanOrder = async (qrCode: string) => {
    if (!activeParcel) {
      toast.error('Create a shipment first');
      return;
    }

    const order = getOrderByQr(qrCode);

    if (!order) {
      toast.error('Order not found — scan it at Receive Orders first');
      return;
    }
    if (scannedOrders.includes(order.id)) {
      toast.error('Order already scanned in this shipment');
      return;
    }
    if (order.status !== 'RECEIVED') {
      toast.error(`Order status is ${order.status} — must be RECEIVED first`);
      return;
    }

    const result = await addOrderToParcel(order.id, activeParcel.id);

    if (result.success) {
      setScannedOrders(prev => [...prev, order.id]);
      toast.success(`Order added`);
    } else {
      toast.error(result.error ?? 'Failed to add order');
    }
  };

  const handleCloseParcel = async () => {
    if (!activeParcel) return;

    setIsClosing(true);
    const result = await closeParcel(activeParcel.id);
    setIsClosing(false);

    if (result.success) {
      toast.success('Shipment closed and ready for dispatch');
      setShowCloseDialog(false);
      navigate('/dispatch');
    } else {
      toast.error(result.error ?? 'Failed to close shipment');
    }
  };

  const handleRemoveOrder = (orderId: string) => {
    setScannedOrders(prev => prev.filter(id => id !== orderId));
    toast.info('Order removed from shipment');
  };

  return (
    <Layout>
      <PageHeader
        title="Create Shipment"
        subtitle="Bag orders for next destination"
        backTo="/dashboard"
      />

      <div className="max-w-xl mx-auto space-y-8">
        {!activeParcel ? (
          <div className="bg-card border border-border rounded-xl p-6 space-y-6">
            <div className="space-y-3">
              <label className="text-base font-medium flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Destination City
              </label>
              <Select value={selectedDestination} onValueChange={setSelectedDestination}>
                <SelectTrigger className="h-14 text-base">
                  <SelectValue placeholder="Select destination" />
                </SelectTrigger>
                <SelectContent>
                  {availableWarehouses.map(w => (
                    <SelectItem key={w.id} value={w.city} className="py-3 text-base">
                      {w.name} — {w.city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={() => void handleCreateParcel()}
              disabled={!selectedDestination || isCreating}
              className="w-full h-14 text-lg font-semibold"
            >
              {isCreating ? (
                <Loader2 className="w-6 h-6 mr-2 animate-spin" />
              ) : (
                <PackagePlus className="w-6 h-6 mr-2" />
              )}
              {isCreating ? 'Creating…' : 'Create New Shipment'}
            </Button>
          </div>
        ) : (
          <>
            {/* Active Shipment Header */}
            <div className="bg-primary/10 border-2 border-primary rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-primary rounded-lg">
                    <Package className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Shipment ID</p>
                    <p className="text-lg font-bold font-mono">{activeParcel.id.slice(0, 8)}…</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Destination</p>
                  <p className="text-xl font-bold">{activeParcel.destinationCity}</p>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 py-3 bg-card rounded-lg">
                <span className="text-4xl font-bold">{scannedOrders.length}</span>
                <span className="text-muted-foreground">orders scanned</span>
              </div>
            </div>

            {/* Scan Input */}
            <ScanInput
              onScan={qr => void handleScanOrder(qr)}
              placeholder="Scan Order QR to add"
            />

            {/* Scanned Orders List */}
            {scannedOrders.length > 0 && (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="p-4 border-b border-border bg-secondary/50">
                  <h3 className="font-bold">Orders in Shipment</h3>
                </div>
                <div className="divide-y divide-border">
                  {scannedOrders.map(orderId => {
                    const order = orders.find(o => o.id === orderId);
                    return (
                      <div key={orderId} className="p-4 flex items-center justify-between">
                        <div>
                          <p className="font-mono font-bold text-sm">{orderId.slice(0, 12)}…</p>
                          {order && (
                            <p className="text-sm text-muted-foreground">
                              {order.currentCity} → {order.nextDestination}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          aria-label="Remove order"
                          onClick={() => handleRemoveOrder(orderId)}
                          className="p-2 hover:bg-destructive/10 rounded-lg text-destructive transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Close Shipment Button */}
            <Button
              onClick={() => setShowCloseDialog(true)}
              disabled={scannedOrders.length === 0 || isClosing}
              className="w-full h-14 text-lg font-semibold bg-success hover:bg-success/90"
            >
              <Check className="w-6 h-6 mr-2" />
              Close Shipment & Mark Ready
            </Button>
          </>
        )}
      </div>

      <ConfirmDialog
        open={showCloseDialog}
        onOpenChange={setShowCloseDialog}
        title="Close Shipment?"
        description={`This shipment contains ${scannedOrders.length} orders going to ${activeParcel?.destinationCity}. Once closed, it will be ready for dispatch.`}
        confirmLabel="Close & Mark Ready"
        onConfirm={() => void handleCloseParcel()}
      />
    </Layout>
  );
}
