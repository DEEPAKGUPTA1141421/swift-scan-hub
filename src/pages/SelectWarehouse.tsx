import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Warehouse, ChevronRight } from 'lucide-react';
import { useWarehouse } from '@/context/WarehouseContext';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

export default function SelectWarehouse() {
  const [selectedId, setSelectedId] = useState('');
  const { warehouses, selectWarehouse, user } = useWarehouse();
  const navigate = useNavigate();

  const handleContinue = () => {
    if (!selectedId) {
      toast.error('Please select a warehouse');
      return;
    }
    
    selectWarehouse(selectedId);
    toast.success('Warehouse selected');
    navigate('/dashboard');
  };

  if (!user) {
    navigate('/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex p-4 bg-primary rounded-2xl mb-4">
            <Warehouse className="w-12 h-12 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold">Select Warehouse</h1>
          <p className="text-muted-foreground mt-2">Choose your working location</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 shadow-sm space-y-6">
          <div className="space-y-3">
            <label className="text-base font-medium">Warehouse</label>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="h-14 text-base">
                <SelectValue placeholder="Select a warehouse" />
              </SelectTrigger>
              <SelectContent>
                {warehouses.map((wh) => (
                  <SelectItem key={wh.id} value={wh.id} className="py-3">
                    <div>
                      <p className="font-medium">{wh.name}</p>
                      <p className="text-sm text-muted-foreground">{wh.city}</p>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleContinue}
            disabled={!selectedId}
            className="w-full h-14 text-lg font-semibold"
          >
            Continue
            <ChevronRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
