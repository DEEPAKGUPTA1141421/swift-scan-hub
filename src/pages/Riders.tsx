import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, Users, Phone, MapPin, Bike, Navigation } from 'lucide-react';
import { toast } from 'sonner';
import { Layout } from '@/components/Layout';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { useWarehouse } from '@/context/WarehouseContext';
import { riderApi, RiderAssignmentBundle } from '@/services/api';
import { ApiError } from '@/lib/apiClient';

interface DisplayBundle extends RiderAssignmentBundle {
  riderCode?: string;
  vehicleNumber?: string;
  distanceFromWarehouseKm?: number;
  speedKmh?: number;
}

export default function Riders() {
  const { currentWarehouse } = useWarehouse();
  const [bundles, setBundles] = useState<DisplayBundle[]>([]);
  const [loading, setLoading] = useState(true);

  const warehouseId = currentWarehouse?.id;

  const load = useCallback(async () => {
    if (!warehouseId) return;
    setLoading(true);
    try {
      const [assignRes, liveRes] = await Promise.allSettled([
        riderApi.getRouteAssignments(warehouseId),
        riderApi.getLiveRiders(warehouseId),
      ]);

      const assignedBundles: DisplayBundle[] =
        assignRes.status === 'fulfilled' ? (assignRes.value.data ?? []) : [];

      if (assignRes.status === 'rejected') {
        const e = assignRes.reason as unknown;
        toast.error(e instanceof ApiError ? e.message : 'Failed to load riders');
      }

      // Build a lookup of live data keyed by riderId to enrich assigned bundles too
      const liveMap = new Map<string, Record<string, string>>();
      if (liveRes.status === 'fulfilled' && Array.isArray(liveRes.value.data)) {
        for (const raw of liveRes.value.data) {
          if (raw.riderId) liveMap.set(raw.riderId, raw);
        }
      }

      // Enrich assigned bundles with live metadata
      const enriched: DisplayBundle[] = assignedBundles.map(b => {
        const live = liveMap.get(b.riderId);
        if (!live) return b;
        return {
          ...b,
          riderCode: live.riderCode,
          vehicleNumber: live.vehicleNumber,
          distanceFromWarehouseKm: live.distanceFromWarehouseKm
            ? Number(live.distanceFromWarehouseKm)
            : undefined,
          speedKmh: live.speedKmh ? parseFloat(live.speedKmh) : undefined,
        };
      });

      // Add riders present in live feed but with no assignments
      const assignedIds = new Set(enriched.map(b => b.riderId));
      const extraBundles: DisplayBundle[] = [];

      for (const [id, raw] of liveMap.entries()) {
        if (assignedIds.has(id)) continue;
        extraBundles.push({
          riderId: id,
          riderName: raw.name ?? `Rider ${id.slice(-6)}`,
          riderPhone: raw.phone ?? undefined,
          currentLat: parseFloat(raw.lat ?? '0'),
          currentLng: parseFloat(raw.lng ?? '0'),
          totalStops: 0,
          completed: 0,
          assignments: [],
          riderCode: raw.riderCode,
          vehicleNumber: raw.vehicleNumber,
          distanceFromWarehouseKm: raw.distanceFromWarehouseKm
            ? Number(raw.distanceFromWarehouseKm)
            : undefined,
          speedKmh: raw.speedKmh ? parseFloat(raw.speedKmh) : undefined,
        });
      }

      setBundles([...enriched, ...extraBundles]);
    } finally {
      setLoading(false);
    }
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
            <p>No active riders online right now.</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {bundles.map(b => {
            const pct = b.totalStops > 0 ? Math.round((b.completed / b.totalStops) * 100) : 0;
            return (
              <div key={b.riderId} className="bg-card border rounded-lg p-4">
                {/* Header row */}
                <div className="flex items-start justify-between mb-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{b.riderName}</p>
                      {b.riderCode && (
                        <span className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                          {b.riderCode}
                        </span>
                      )}
                    </div>
                    {b.riderPhone && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {b.riderPhone}
                      </p>
                    )}
                    {b.vehicleNumber && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Bike className="w-3 h-3" /> {b.vehicleNumber}
                      </p>
                    )}
                    {(b.currentLat !== 0 || b.currentLng !== 0) && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {b.currentLat.toFixed(4)}, {b.currentLng.toFixed(4)}
                      </p>
                    )}
                  </div>

                  <div className="text-right shrink-0 ml-2 space-y-1">
                    {b.totalStops === 0 ? (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                        No assignments
                      </span>
                    ) : (
                      <>
                        <p className="text-xs text-muted-foreground">Progress</p>
                        <p className="font-bold">{b.completed}/{b.totalStops}</p>
                      </>
                    )}
                    {b.distanceFromWarehouseKm != null && (
                      <p className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                        <Navigation className="w-3 h-3" />
                        {b.distanceFromWarehouseKm.toFixed(1)} km away
                      </p>
                    )}
                    {b.speedKmh != null && b.speedKmh > 0 && (
                      <p className="text-xs text-muted-foreground">{b.speedKmh} km/h</p>
                    )}
                  </div>
                </div>

                {b.totalStops > 0 && (
                  <div className="w-full bg-muted rounded-full h-1.5 mb-3">
                    <div
                      className="bg-primary h-1.5 rounded-full transition-all [width:var(--pct)]"
                      style={{ '--pct': `${pct}%` } as React.CSSProperties}
                    />
                  </div>
                )}

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
                    <p className="text-xs text-muted-foreground text-center py-2">
                      Rider is active — no delivery stops assigned yet
                    </p>
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
