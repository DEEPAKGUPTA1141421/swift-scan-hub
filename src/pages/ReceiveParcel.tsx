import { useState } from 'react';
import { Package, MapPin, Hash, PackageOpen, CheckCircle, FolderOpen, Loader2 } from 'lucide-react';
import { useWarehouse } from '@/context/WarehouseContext';
import { Layout } from '@/components/Layout';
import { PageHeader } from '@/components/PageHeader';
import { ScanInput } from '@/components/ScanInput';
import { StatusBadge } from '@/components/StatusBadge';
import { OtpDialog } from '@/components/OtpDialog';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Parcel } from '@/types/warehouse';
import { parcelApi } from '@/services/api';
import { toast } from 'sonner';

export default function ReceiveParcel() {
  const [scannedParcel, setScannedParcel] = useState<Parcel | null>(null);
  const [received, setReceived] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [showOpenDialog, setShowOpenDialog] = useState(false);
  const [isOpening, setIsOpening] = useState(false);

  // OTP state for warehouse-in verification of individual parcels
  const [otpOpen, setOtpOpen] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [pendingOtpParcelIds, setPendingOtpParcelIds] = useState<string[]>([]);
  const [currentOtpIndex, setCurrentOtpIndex] = useState(0);

  const { getParcelByQr, receiveParcel, openParcel, currentWarehouse, user } = useWarehouse();

  const handleScan = async (qrCode: string) => {
    setIsLookingUp(true);
    try {
      const result = await receiveParcel(qrCode);

      if (result.success && result.parcel) {
        setScannedParcel(result.parcel);
        setReceived(true);
        toast.success('Shipment received at warehouse');

        // Initiate warehouse-in OTP for each contained parcel
        if (result.parcel.orders.length > 0) {
          await Promise.allSettled(
            result.parcel.orders.map(parcelId => parcelApi.initiateWarehouseIn(parcelId))
          );
          setPendingOtpParcelIds(result.parcel.orders);
          setCurrentOtpIndex(0);
          setOtpOpen(true);
          toast.info(`Enter OTPs to confirm ${result.parcel.orders.length} parcel(s) warehouse-in`);
        }
      } else if (!result.success && result.error?.includes('not in transit')) {
        // Try local cache for already-received shipments
        const local = getParcelByQr(qrCode);
        if (local?.status === 'RECEIVED') {
          setScannedParcel(local);
          setReceived(true);
          toast.info('Shipment already received — you can open it');
        } else {
          toast.error(result.error ?? 'Shipment not found');
        }
      } else {
        toast.error(result.error ?? 'Failed to receive shipment');
      }
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleOtpSubmit = async (otp: string) => {
    const parcelId = pendingOtpParcelIds[currentOtpIndex];
    if (!parcelId) return;

    setOtpLoading(true);
    try {
      const res = await parcelApi.verifyWarehouseIn(parcelId, otp, user?.id ?? 'operator');
      if (res.data.verified) {
        const next = currentOtpIndex + 1;
        if (next < pendingOtpParcelIds.length) {
          setCurrentOtpIndex(next);
          toast.success(`Parcel ${currentOtpIndex + 1} verified — ${pendingOtpParcelIds.length - next} remaining`);
        } else {
          setOtpOpen(false);
          setPendingOtpParcelIds([]);
          toast.success('All parcels verified — shipment ready to open');
        }
      } else {
        toast.error('Invalid OTP — try again');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'OTP verification failed';
      toast.error(msg);
    } finally {
      setOtpLoading(false);
    }
  };

  const handleOpenParcel = async () => {
    if (!scannedParcel) return;
    setIsOpening(true);
    const result = await openParcel(scannedParcel.id);
    setIsOpening(false);

    if (result.success) {
      toast.success(`Shipment opened — ${scannedParcel.orders.length} orders now available for routing`);
      setShowOpenDialog(false);
      setScannedParcel(null);
      setReceived(false);
    } else {
      toast.error(result.error ?? 'Failed to open shipment');
    }
  };

  const handleReset = () => {
    setScannedParcel(null);
    setReceived(false);
  };

  const currentOtpParcelId = pendingOtpParcelIds[currentOtpIndex];

  return (
    <Layout>
      <PageHeader
        title="Receive Shipment"
        subtitle="Accept incoming shipments from other warehouses"
        backTo="/dashboard"
      />

      <div className="max-w-xl mx-auto space-y-8">
        <ScanInput
          onScan={qr => void handleScan(qr)}
          placeholder="Scan Shipment QR / UUID"
        />

        {isLookingUp && (
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Looking up shipment…</span>
          </div>
        )}

        {scannedParcel && received && (
          <div className="space-y-6">
            <div className="bg-success/10 border-2 border-success rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-success rounded-lg">
                  <CheckCircle className="w-6 h-6 text-success-foreground" />
                </div>
                <div>
                  <p className="font-bold text-lg text-success">Shipment Received</p>
                  <p className="text-sm text-muted-foreground">at {currentWarehouse?.name}</p>
                </div>
              </div>
            </div>

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
                    <span className="text-sm">From</span>
                  </div>
                  <p className="font-bold text-lg">{scannedParcel.currentWarehouse}</p>
                </div>
                <div className="p-4 bg-secondary rounded-lg">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Hash className="w-4 h-4" />
                    <span className="text-sm">Orders</span>
                  </div>
                  <p className="font-bold text-lg">{scannedParcel.orders.length}</p>
                </div>
              </div>

              <div className="pt-4 border-t border-border space-y-3">
                <Button
                  onClick={() => setShowOpenDialog(true)}
                  disabled={isOpening}
                  className="w-full h-14 text-lg font-semibold"
                >
                  <FolderOpen className="w-6 h-6 mr-2" />
                  Open Shipment
                </Button>
                <p className="text-sm text-center text-muted-foreground">
                  Opening will make orders available for next routing step
                </p>
              </div>
            </div>

            <Button onClick={handleReset} variant="outline" className="w-full h-12">
              <PackageOpen className="w-5 h-5 mr-2" />
              Scan Another Shipment
            </Button>
          </div>
        )}
      </div>

      <OtpDialog
        open={otpOpen}
        title={`Verify Parcel ${currentOtpIndex + 1} of ${pendingOtpParcelIds.length}`}
        description={`Enter the OTP for parcel ID …${currentOtpParcelId?.slice(-8) ?? ''} to confirm warehouse-in.`}
        isLoading={otpLoading}
        onSubmit={handleOtpSubmit}
        onCancel={() => { setOtpOpen(false); setPendingOtpParcelIds([]); }}
      />

      <ConfirmDialog
        open={showOpenDialog}
        onOpenChange={setShowOpenDialog}
        title="Open Shipment?"
        description={`This will unpack ${scannedParcel?.orders.length} orders and make them available for the next routing step.`}
        confirmLabel={isOpening ? 'Opening…' : 'Open Shipment'}
        onConfirm={() => void handleOpenParcel()}
      />
    </Layout>
  );
}
