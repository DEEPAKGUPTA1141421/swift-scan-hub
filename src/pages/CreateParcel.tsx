import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Package, PackagePlus, X, Check, MapPin } from 'lucide-react';
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

const CITIES = ['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Kolkata', 'Hyderabad', 'Pune'];

export default function CreateParcel() {
  const [searchParams] = useSearchParams();
  const [selectedDestination, setSelectedDestination] = useState(searchParams.get('destination') || '');
  const [activeParcel, setActiveParcel] = useState<Parcel | null>(null);
  const [scannedOrders, setScannedOrders] = useState<string[]>([]);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const navigate = useNavigate();
  
  const { 
    createParcel, 
    addOrderToParcel, 
    closeParcel, 
    getOrderByQr, 
    orders,
    currentWarehouse 
  } = useWarehouse();

  const initialOrderId = searchParams.get('orderId');

  useEffect(() => {
    if (initialOrderId && selectedDestination && !activeParcel) {
      handleCreateParcel();
    }
  }, []);

  const handleCreateParcel = () => {
    if (!selectedDestination) {
      toast.error('Please select a destination city');
      return;
    }

    const parcel = createParcel(selectedDestination);
    setActiveParcel(parcel);
    setScannedOrders([]);
    toast.success(`Parcel ${parcel.id} created`);

    // If there's an initial order, add it
    if (initialOrderId) {
      setTimeout(() => handleScanOrder(initialOrderId), 100);
    }
  };

  const handleScanOrder = (qrCode: string) => {
    if (!activeParcel) {
      toast.error('Create a parcel first');
      return;
    }

    const order = getOrderByQr(qrCode);
    
    if (!order) {
      toast.error('Order not found - scan it at Receive Orders first');
      return;
    }

    if (scannedOrders.includes(order.id)) {
      toast.error('Order already scanned in this parcel');
      return;
    }

    if (order.status !== 'RECEIVED') {
      toast.error(`Order status is ${order.status} - must be RECEIVED first`);
      return;
    }

    const result = addOrderToParcel(order.id, activeParcel.id);
    
    if (result.success) {
      setScannedOrders(prev => [...prev, order.id]);
      toast.success(`Order ${order.id} added`);
    } else {
      toast.error(result.error || 'Failed to add order');
    }
  };

  const handleCloseParcel = () => {
    if (!activeParcel) return;

    const result = closeParcel(activeParcel.id);
    
    if (result.success) {
      toast.success('Parcel closed and ready for dispatch');
      setShowCloseDialog(false);
      navigate('/dispatch');
    } else {
      toast.error(result.error || 'Failed to close parcel');
    }
  };

  const handleRemoveOrder = (orderId: string) => {
    // Note: In a real app, this would update the backend
    setScannedOrders(prev => prev.filter(id => id !== orderId));
    toast.info('Order removed from parcel');
  };

  const availableCities = CITIES.filter(city => city !== currentWarehouse?.city);

  return (
    <Layout>
      <PageHeader 
        title="Create Parcel" 
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
                  {availableCities.map(city => (
                    <SelectItem key={city} value={city} className="py-3 text-base">
                      {city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleCreateParcel}
              disabled={!selectedDestination}
              className="w-full h-14 text-lg font-semibold"
            >
              <PackagePlus className="w-6 h-6 mr-2" />
              Create New Parcel
            </Button>
          </div>
        ) : (
          <>
            {/* Active Parcel Header */}
            <div className="bg-primary/10 border-2 border-primary rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-primary rounded-lg">
                    <Package className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Parcel ID</p>
                    <p className="text-xl font-bold font-mono">{activeParcel.id}</p>
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
              onScan={handleScanOrder} 
              placeholder="Scan Order QR to add" 
            />

            {/* Scanned Orders List */}
            {scannedOrders.length > 0 && (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="p-4 border-b border-border bg-secondary/50">
                  <h3 className="font-bold">Orders in Parcel</h3>
                </div>
                <div className="divide-y divide-border">
                  {scannedOrders.map(orderId => {
                    const order = orders.find(o => o.id === orderId);
                    return (
                      <div key={orderId} className="p-4 flex items-center justify-between">
                        <div>
                          <p className="font-mono font-bold">{orderId}</p>
                          {order && (
                            <p className="text-sm text-muted-foreground">
                              Route step {order.routeSequence}
                            </p>
                          )}
                        </div>
                        <button
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

            {/* Close Parcel Button */}
            <Button
              onClick={() => setShowCloseDialog(true)}
              disabled={scannedOrders.length === 0}
              className="w-full h-14 text-lg font-semibold bg-success hover:bg-success/90"
            >
              <Check className="w-6 h-6 mr-2" />
              Close Parcel & Mark Ready
            </Button>
          </>
        )}
      </div>

      <ConfirmDialog
        open={showCloseDialog}
        onOpenChange={setShowCloseDialog}
        title="Close Parcel?"
        description={`This parcel contains ${scannedOrders.length} orders going to ${activeParcel?.destinationCity}. Once closed, it will be ready for dispatch.`}
        confirmLabel="Close & Mark Ready"
        onConfirm={handleCloseParcel}
      />
    </Layout>
  );
}
