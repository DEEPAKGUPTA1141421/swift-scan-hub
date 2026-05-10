import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Map, RefreshCw, Zap, Wifi, WifiOff, ArrowLeft,
  Bike, Package, CheckCircle2,
} from 'lucide-react';
import { useWarehouse } from '@/context/WarehouseContext';
import { useLiveRiders } from '@/hooks/useLiveRiders';
import { MapPanel } from '@/components/map/MapPanel';
import { RiderSidePanel } from '@/components/RiderSidePanel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { vrpApi } from '@/services/api';
import { toast } from 'sonner';

export default function LiveMapDashboard() {
  const { user, currentWarehouse } = useWarehouse();
  const navigate = useNavigate();

  // Auth guard
  useEffect(() => {
    if (!user)             navigate('/login');
    else if (!currentWarehouse) navigate('/select-warehouse');
  }, [user, currentWarehouse, navigate]);

  const { riders, loading, readyState, refetch } = useLiveRiders(currentWarehouse?.id);
  const [triggeringVrp, setTriggeringVrp] = useState(false);

  const handleTriggerVrp = async () => {
    setTriggeringVrp(true);
    try {
      await vrpApi.trigger(currentWarehouse?.id ? [currentWarehouse.id] : undefined);
      toast.success('VRP batch queued — routes will appear when complete');
    } catch {
      toast.error('Failed to trigger VRP batch');
    } finally {
      setTriggeringVrp(false);
    }
  };

  if (!user || !currentWarehouse) return null;

  // Aggregate stats
  const totalRiders     = riders.length;
  const activeRiders    = riders.filter(r => r.speedKmh > 1).length;
  const totalStops      = riders.reduce((s, r) => s + r.totalStops, 0);
  const completedStops  = riders.reduce((s, r) => s + r.completedStops, 0);

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* ── Top bar ───────────────────────────────────────────────── */}
      <header className="bg-card border-b border-border px-4 py-2 flex items-center gap-3 shrink-0">
        <Link to="/dashboard">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>

        <div className="flex items-center gap-2">
          <Map className="w-5 h-5 text-primary" />
          <div>
            <p className="font-bold text-sm leading-none">{currentWarehouse.name}</p>
            <p className="text-xs text-muted-foreground">Live Delivery Map</p>
          </div>
        </div>

        {/* Stat chips */}
        <div className="hidden md:flex items-center gap-2 ml-4">
          <StatChip icon={Bike}         value={`${activeRiders}/${totalRiders}`} label="Moving" />
          <StatChip icon={Package}      value={totalStops}                       label="Total stops" />
          <StatChip icon={CheckCircle2} value={completedStops}                   label="Delivered" />
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* WS status indicator */}
          <Badge variant={readyState === 'CONNECTED' ? 'default' : 'secondary'}
            className="gap-1 text-xs">
            {readyState === 'CONNECTED'
              ? <><Wifi className="w-3 h-3" /> Live</>
              : <><WifiOff className="w-3 h-3" /> {readyState === 'CONNECTING' ? 'Connecting…' : 'Offline'}</>
            }
          </Badge>

          <Button variant="outline" size="sm" onClick={refetch} disabled={loading} className="gap-1.5 h-8">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          <Button size="sm" onClick={handleTriggerVrp} disabled={triggeringVrp} className="gap-1.5 h-8">
            <Zap className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{triggeringVrp ? 'Queuing…' : 'Run VRP'}</span>
          </Button>
        </div>
      </header>

      {/* ── Main split layout ─────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Map — 60% */}
        <div className="flex-[3] relative">
          {loading && riders.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center z-[1000] bg-background/60 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <RefreshCw className="w-6 h-6 animate-spin" />
                <p className="text-sm">Loading rider positions…</p>
              </div>
            </div>
          )}
          <MapPanel
            riders={riders}
            warehouseLat={currentWarehouse.lat}
            warehouseLng={currentWarehouse.lng}
          />
        </div>

        {/* Sidebar — 40% */}
        <div className="flex-[2] border-l border-border flex flex-col overflow-hidden max-w-sm">
          <div className="px-3 py-2.5 border-b border-border shrink-0">
            <p className="font-semibold text-sm">Active Riders</p>
            <p className="text-xs text-muted-foreground">{totalRiders} assigned today</p>
          </div>
          <RiderSidePanel riders={riders} />
        </div>
      </div>
    </div>
  );
}

function StatChip({
  icon: Icon, value, label,
}: {
  icon: React.ElementType;
  value: string | number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5 bg-secondary rounded-lg px-2.5 py-1">
      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
      <span className="font-bold text-sm">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
