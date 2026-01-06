import { useState } from 'react';
import { Package, MapPin, Hash, PackageOpen, CheckCircle, FolderOpen } from 'lucide-react';
import { useWarehouse } from '@/context/WarehouseContext';
import { Layout } from '@/components/Layout';
import { PageHeader } from '@/components/PageHeader';
import { ScanInput } from '@/components/ScanInput';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Parcel } from '@/types/warehouse';
import { toast } from 'sonner';

export default function ReceiveParcel() {
  const [scannedParcel, setScannedParcel] = useState<Parcel | null>(null);
  const [received, setReceived] = useState(false);
  const [showOpenDialog, setShowOpenDialog] = useState(false);
  
  const { getParcelByQr, receiveParcel, openParcel, currentWarehouse } = useWarehouse();

  const handleScan = (qrCode: string) => {
    const parcel = getParcelByQr(qrCode);
    
    if (!parcel) {
      toast.error('Parcel not found');
      return;
    }

    if (parcel.status === 'OPEN' || parcel.status === 'READY_TO_DISPATCH') {
      toast.error('This parcel has not been dispatched yet');
      return;
    }

    if (parcel.status === 'RECEIVED') {
      setScannedParcel(parcel);
      setReceived(true);
      toast.info('Parcel already received - you can open it');
      return;
    }

    // Receive the parcel
    const result = receiveParcel(qrCode);
    
    if (result.success && result.parcel) {
      setScannedParcel(result.parcel);
      setReceived(true);
      toast.success('Parcel received at warehouse');
    } else {
      toast.error(result.error || 'Failed to receive parcel');
    }
  };

  const handleOpenParcel = () => {
    if (!scannedParcel) return;

    const result = openParcel(scannedParcel.id);
    
    if (result.success) {
      toast.success(`Parcel opened - ${scannedParcel.orders.length} orders now available for routing`);
      setShowOpenDialog(false);
      setScannedParcel(null);
      setReceived(false);
    } else {
      toast.error(result.error || 'Failed to open parcel');
    }
  };

  const handleReset = () => {
    setScannedParcel(null);
    setReceived(false);
  };

  return (
    <Layout>
      <PageHeader 
        title="Receive Parcel" 
        subtitle="Accept parcels from other warehouses"
        backTo="/dashboard" 
      />

      <div className="max-w-xl mx-auto space-y-8">
        <ScanInput 
          onScan={handleScan} 
          placeholder="Scan Parcel QR Code" 
        />

        {scannedParcel && received && (
          <div className="space-y-6">
            <div className="bg-success/10 border-2 border-success rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-success rounded-lg">
                  <CheckCircle className="w-6 h-6 text-success-foreground" />
                </div>
                <div>
                  <p className="font-bold text-lg text-success">Parcel Received</p>
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
                    <p className="text-sm text-muted-foreground">Parcel ID</p>
                    <p className="text-xl font-bold font-mono">{scannedParcel.id}</p>
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

              <div className="pt-4 border-t border-border space-y-3">
                <Button
                  onClick={() => setShowOpenDialog(true)}
                  className="w-full h-14 text-lg font-semibold"
                >
                  <FolderOpen className="w-6 h-6 mr-2" />
                  Open Parcel
                </Button>
                <p className="text-sm text-center text-muted-foreground">
                  Opening will make orders available for next routing step
                </p>
              </div>
            </div>

            <Button
              onClick={handleReset}
              variant="outline"
              className="w-full h-12"
            >
              <PackageOpen className="w-5 h-5 mr-2" />
              Scan Another Parcel
            </Button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={showOpenDialog}
        onOpenChange={setShowOpenDialog}
        title="Open Parcel?"
        description={`This will unpack ${scannedParcel?.orders.length} orders and make them available for the next routing step. The parcel will be removed.`}
        confirmLabel="Open Parcel"
        onConfirm={handleOpenParcel}
      />
    </Layout>
  );
}
