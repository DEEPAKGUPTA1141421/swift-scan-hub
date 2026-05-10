import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, MapPin, Route, CheckCircle, Plus, Loader2 } from 'lucide-react';
import { useWarehouse } from '@/context/WarehouseContext';
import { Layout } from '@/components/Layout';
import { PageHeader } from '@/components/PageHeader';
import { ScanInput } from '@/components/ScanInput';
import { StatusBadge } from '@/components/StatusBadge';
import { OtpDialog } from '@/components/OtpDialog';
import { Button } from '@/components/ui/button';
import { Order } from '@/types/warehouse';
import { toast } from 'sonner';

export default function ReceiveOrders() {
  const [scannedOrder, setScannedOrder] = useState<Order | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [otpOpen, setOtpOpen] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [pendingParcelId, setPendingParcelId] = useState<string | null>(null);

  const { receiveOrder, confirmWarehouseIn, getOrderByQr, addOrderToParcel, parcels, currentWarehouse } = useWarehouse();
  const navigate = useNavigate();

  const openParcels = parcels.filter(p => p.status === 'OPEN' && p.currentWarehouse === currentWarehouse?.city);

  const handleScan = async (qrCode: string) => {
    // Check local cache first
    const cached = getOrderByQr(qrCode);
    if (cached && cached.status !== 'PENDING') {
      setScannedOrder(cached);
      if (cached.status === 'RECEIVED') toast.info('Order already received — can add to parcel');
      else if (cached.status === 'IN_PARCEL') toast.warning('Order already in a parcel');
      return;
    }

    setIsScanning(true);
    const result = await receiveOrder(qrCode);
    setIsScanning(false);

    if (result.success && result.order) {
      setScannedOrder(result.order);
      if (result.needsOtp) {
        setPendingParcelId(qrCode);
        setOtpOpen(true);
        toast.info('OTP sent — enter it to confirm receipt');
      } else {
        toast.success('Order received successfully');
      }
    } else {
      toast.error(result.error ?? 'Failed to receive order');
      setScannedOrder(null);
    }
  };

  const handleOtpSubmit = async (otp: string) => {
    if (!pendingParcelId) return;
    setOtpLoading(true);
    const result = await confirmWarehouseIn(pendingParcelId, otp);
    setOtpLoading(false);

    if (result.success) {
      setOtpOpen(false);
      setPendingParcelId(null);
      // Refresh the scanned order from updated state
      const updated = getOrderByQr(pendingParcelId);
      if (updated) setScannedOrder(updated);
      toast.success('Warehouse-in confirmed');
    } else {
      toast.error(result.error ?? 'OTP verification failed');
    }
  };

  const handleAddToParcel = async (parcelId: string) => {
    if (!scannedOrder) return;
    const result = await addOrderToParcel(scannedOrder.id, parcelId);
    if (result.success) {
      toast.success('Order added to parcel');
      setScannedOrder(null);
    } else {
      toast.error(result.error ?? 'Failed to add to parcel');
    }
  };

  const handleCreateNewParcel = () => {
    if (scannedOrder) {
      navigate(`/create-parcel?destination=${scannedOrder.nextDestination}&orderId=${scannedOrder.id}`);
    } else {
      navigate('/create-parcel');
    }
  };

  return (
    <Layout>
      <PageHeader
        title="Receive Orders"
        subtitle="Scan parcel QR codes from incoming riders"
        backTo="/dashboard"
      />

      <div className="max-w-xl mx-auto space-y-8">
        <ScanInput onScan={handleScan} placeholder="Scan Parcel QR / UUID" />

        {isScanning && (
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Looking up order…</span>
          </div>
        )}

        {scannedOrder && (
          <div className="bg-card border border-border rounded-xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Package className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Parcel ID</p>
                  <p className="text-xl font-bold font-mono truncate max-w-[200px]">{scannedOrder.id}</p>
                </div>
              </div>
              <StatusBadge status={scannedOrder.status} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-secondary rounded-lg">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <MapPin className="w-4 h-4" />
                  <span className="text-sm">Current City</span>
                </div>
                <p className="font-bold text-lg">{scannedOrder.currentCity}</p>
              </div>
              <div className="p-4 bg-secondary rounded-lg">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <MapPin className="w-4 h-4" />
                  <span className="text-sm">Next Destination</span>
                </div>
                <p className="font-bold text-lg">{scannedOrder.nextDestination}</p>
              </div>
            </div>

            <div className="p-4 bg-secondary rounded-lg">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Route className="w-4 h-4" />
                <span className="text-sm">Route Sequence</span>
              </div>
              <p className="font-bold text-lg">Step {scannedOrder.routeSequence}</p>
            </div>

            {scannedOrder.status === 'RECEIVED' && (
              <div className="space-y-3">
                <p className="font-medium">Add to Shipment</p>

                {openParcels.filter(p => p.destinationCity === scannedOrder.nextDestination).length > 0 ? (
                  <div className="space-y-2">
                    {openParcels
                      .filter(p => p.destinationCity === scannedOrder.nextDestination)
                      .map(parcel => (
                        <button
                          key={parcel.id}
                          type="button"
                          onClick={() => handleAddToParcel(parcel.id)}
                          className="w-full p-4 bg-accent/10 border border-accent/30 rounded-lg
                                     hover:bg-accent/20 transition-colors text-left flex items-center justify-between"
                        >
                          <div>
                            <p className="font-bold font-mono text-sm">{parcel.id}</p>
                            <p className="text-sm text-muted-foreground">
                              {parcel.orders.length} orders → {parcel.destinationCity}
                            </p>
                          </div>
                          <Plus className="w-5 h-5 text-accent" />
                        </button>
                      ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No open shipments for {scannedOrder.nextDestination}
                  </p>
                )}

                <Button
                  onClick={handleCreateNewParcel}
                  variant="outline"
                  className="w-full h-12"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Create New Shipment for {scannedOrder.nextDestination}
                </Button>
              </div>
            )}

            {scannedOrder.status === 'PENDING' && (
              <div className="flex items-center gap-3 p-4 bg-success/10 border border-success/30 rounded-lg text-success">
                <CheckCircle className="w-6 h-6" />
                <div>
                  <p className="font-bold">Ready to Receive</p>
                  <p className="text-sm opacity-80">Order scanned and validated</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <OtpDialog
        open={otpOpen}
        title="Confirm Warehouse Receipt"
        description="Enter the OTP sent to the rider to confirm parcel arrival at this warehouse."
        isLoading={otpLoading}
        onSubmit={handleOtpSubmit}
        onCancel={() => { setOtpOpen(false); setPendingParcelId(null); }}
      />
    </Layout>
  );
}
