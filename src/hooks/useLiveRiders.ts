import { useCallback, useEffect, useRef, useState } from 'react';
import { LiveRider, WsMessage } from '@/types/warehouse';
import { useWebSocket } from './useWebSocket';
import { riderApi } from '@/services/api';

/**
 * Combines an initial HTTP load of rider positions with live WebSocket updates.
 *
 * Strategy (stale-while-revalidate):
 *   1. On mount: GET /warehouse/{id}/riders/live → seed the map immediately.
 *   2. WS RIDER_LOCATION events patch individual riders in place (no full re-fetch).
 *   3. WS VRP_COMPLETE triggers a full re-fetch so new riders appear on the map.
 */
export function useLiveRiders(warehouseId: string | undefined) {
  const [riders, setRiders] = useState<Map<string, LiveRider>>(new Map());
  const [loading, setLoading] = useState(false);

  // ── Initial HTTP load ────────────────────────────────────────────
  const fetchSeed = useCallback(async () => {
    if (!warehouseId) return;
    setLoading(true);
    try {
      const res = await riderApi.getLiveRiders(warehouseId);
      if (res.success && Array.isArray(res.data)) {
        setRiders(prev => {
          const next = new Map(prev);
          for (const raw of res.data) {
            const id = raw.riderId;
            if (!id) continue;
            next.set(id, rawToLiveRider(raw, prev.get(id)));
          }
          return next;
        });
      }
    } catch {
      // silently fall back to WS-only mode
    } finally {
      setLoading(false);
    }
  }, [warehouseId]);

  useEffect(() => { void fetchSeed(); }, [fetchSeed]);

  // ── WebSocket message handler ────────────────────────────────────
  const handleMessage = useCallback((msg: WsMessage) => {
    if (msg.type === 'RIDER_LOCATION') {
      const id = msg.riderId as string;
      if (!id) return;
      setRiders(prev => {
        const next = new Map(prev);
        const existing = prev.get(id);
        next.set(id, {
          ...(existing ?? defaultRider(id)),
          lat:       parseFloat(msg.lat as string),
          lng:       parseFloat(msg.lng as string),
          heading:   parseFloat((msg.heading as string) ?? '0'),
          speedKmh:  parseFloat((msg.speedKmh as string) ?? '0'),
          updatedAt: (msg.updatedAt as string) ?? new Date().toISOString(),
        });
        return next;
      });
    }

    if (msg.type === 'ORDER_STATUS') {
      const riderId    = msg.riderId as string;
      const newStatus  = msg.newStatus as string;
      const assignmentId = msg.assignmentId as string;
      if (!riderId) return;

      setRiders(prev => {
        const rider = prev.get(riderId);
        if (!rider) return prev;
        const next = new Map(prev);
        next.set(riderId, {
          ...rider,
          stops: rider.stops.map(s =>
            s.assignmentId === assignmentId
              ? { ...s, status: newStatus as LiveRider['stops'][0]['status'] }
              : s
          ),
          completedStops: rider.stops.filter(
            s => s.assignmentId === assignmentId
              ? (newStatus === 'DELIVERED' || newStatus === 'FAILED')
              : (s.status === 'DELIVERED' || s.status === 'FAILED')
          ).length,
        });
        return next;
      });
    }

    if (msg.type === 'VRP_COMPLETE') {
      // New batch run finished — re-seed so new riders appear
      void fetchSeed();
    }
  }, [fetchSeed]);

  const topics = warehouseId
    ? [`/topic/warehouse/${warehouseId}/live`, '/topic/warehouse/orders/status']
    : [];

  const { readyState } = useWebSocket({
    topics,
    onMessage: handleMessage,
    enabled: !!warehouseId,
  });

  return { riders: Array.from(riders.values()), loading, readyState, refetch: fetchSeed };
}

// ── Helpers ──────────────────────────────────────────────────────────────

function rawToLiveRider(
  raw: Record<string, string>,
  existing?: LiveRider
): LiveRider {
  return {
    ...(existing ?? defaultRider(raw.riderId ?? '')),
    riderId:   raw.riderId ?? '',
    lat:       parseFloat(raw.lat ?? '0'),
    lng:       parseFloat(raw.lng ?? '0'),
    heading:   parseFloat(raw.heading ?? '0'),
    speedKmh:  parseFloat(raw.speedKmh ?? '0'),
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
  };
}

function defaultRider(riderId: string): LiveRider {
  return {
    riderId,
    lat: 0, lng: 0, heading: 0, speedKmh: 0,
    updatedAt: new Date().toISOString(),
    totalStops: 0, completedStops: 0, stops: [],
  };
}
