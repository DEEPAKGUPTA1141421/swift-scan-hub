import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, Users, Phone, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { Layout } from '@/components/Layout';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { useWarehouse } from '@/context/WarehouseContext';
import { riderApi, RiderAssignmentBundle } from '@/services/api';
import { ApiError } from '@/lib/apiClient';

export default function Riders() {
  const { currentWarehouse } = useWarehouse();
  const [bundles, setBundles] = useState<RiderAssignmentBundle[]>([]);
  const [loading, setLoading] = useState(true);

  const warehouseId = currentWarehouse?.id;

  const load = useCallback(() => {
    if (!warehouseId) return;
    setLoading(true);
    riderApi.getRouteAssignments(warehouseId)
      .then(res => setBundles(res.data ?? []))
      .catch((e: unknown) =>
        toast.error(e instanceof ApiError ? e.message : 'Failed to load riders'))
      .finally(() => setLoading(false));
  }, [warehouseId]);

  useEffect(() => { load(); }, [load]);

  return (
    <Layout>
      <PageHeader
        title="Active Riders"
        subtitle={`Today's route assignments at ${currentWarehouse?.name ?? 'this warehouse'}`}
        backTo="/dashboard"
      />

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {bundles.length} rider(s) ·{' '}
            {bundles.reduce((sum, b) => sum + b.totalStops, 0)} total stops ·{' '}
            {bundles.reduce((sum, b) => sum + b.completed, 0)} completed
          </span>
          <div className="ml-auto" />
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>

        {loading && (
          <div className="text-center py-12">
            <Loader2 className="w-6 h-6 animate-spin inline" />
          </div>
        )}

        {!loading && bundles.length === 0 && (
          <div className="text-center py-12 text-muted-foreground bg-card border rounded-lg">
            <Users className="w-8 h-8 inline mb-2 opacity-50" />
            <p>No active rider assignments today.</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {bundles.map(b => {
            const pct = b.totalStops > 0 ? Math.round((b.completed / b.totalStops) * 100) : 0;
            return (
              <div key={b.riderId} className="bg-card border rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold">{b.riderName}</p>
                    {b.riderPhone && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3" /> {b.riderPhone}
                      </p>
                    )}
                    {(b.currentLat !== 0 || b.currentLng !== 0) && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" />
                        {b.currentLat.toFixed(4)}, {b.currentLng.toFixed(4)}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Progress</p>
                    <p className="font-bold">{b.completed}/{b.totalStops}</p>
                  </div>
                </div>

                <div className="w-full bg-muted rounded-full h-1.5 mb-3">
                  <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>

                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {b.assignments.map(a => (
                    <div key={a.assignmentId}
                      className="flex items-center gap-2 text-xs bg-muted/30 rounded px-2 py-1.5">
                      <span className="w-5 text-muted-foreground font-mono shrink-0">
                        {a.sequenceNumber}
                      </span>
                      <span className="flex-1 truncate">
                        {a.destAddress}{a.destCity && ` — ${a.destCity}`}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{a.weightKg.toFixed(1)}kg</span>
                      <StatusBadge status={a.status} />
                    </div>
                  ))}
                  {b.assignments.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-2">No stops</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}
