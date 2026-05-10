import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { zoneApi } from '@/services/api';
import type { CreateZonePayload } from '@/types/zone';
import { toast } from 'sonner';

const ZONES_KEY = ['zones'] as const;

export function useZones() {
  return useQuery({
    queryKey: ZONES_KEY,
    queryFn: () => zoneApi.list(),
    staleTime: 30_000,
  });
}

export function useCreateZone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateZonePayload) => zoneApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ZONES_KEY });
      toast.success('Zone created');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateZone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CreateZonePayload }) =>
      zoneApi.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ZONES_KEY });
      toast.success('Zone updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useToggleZoneStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => zoneApi.toggleStatus(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ZONES_KEY });
      toast.success('Zone status updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteZone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => zoneApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ZONES_KEY });
      toast.success('Zone deleted');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRebuildZoneCache() {
  return useMutation({
    mutationFn: () => zoneApi.rebuildCache(),
    onSuccess: () => toast.success('Redis cache rebuilt'),
    onError: (e: Error) => toast.error(e.message),
  });
}
