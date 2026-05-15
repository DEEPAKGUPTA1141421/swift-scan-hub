import { useState } from 'react';
import {
  Truck, RefreshCw, Play, PackageCheck, AlertCircle, ChevronDown,
  ChevronUp, MapPin, Weight, Clock, CheckCircle2, Loader2, Info,
} from 'lucide-react';
import { useWarehouse } from '@/context/WarehouseContext';
import { Layout } from '@/components/Layout';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  shipmentPlanApi,
  type ShipmentPlan,
  type PlannedShipmentGroup,
  type ExecuteGroupRequest,
} from '@/services/api';
import { ApiError } from '@/lib/apiClient';
import { toast } from 'sonner';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtSeconds(s: number): string {
  if (s <= 0) return '—';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtDt(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });
}

// ─── Group card ───────────────────────────────────────────────────────────────

interface GroupCardProps {
  group: PlannedShipmentGroup;
  override: ExecuteGroupRequest;
  onChange: (o: Partial<ExecuteGroupRequest>) => void;
  selected: boolean;
  onToggle: () => void;
}

function GroupCard({ group, override, onChange, selected, onToggle }: GroupCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`border rounded-lg overflow-hidden transition-colors ${selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'}`}>
      {/* Header row */}
      <div className="flex items-center gap-3 p-4">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 cursor-pointer"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 truncate">
              {group.destinationWarehouseName}
            </span>
            <Badge variant={group.shipmentType === 'LAST_MILE' ? 'default' : 'secondary'}>
              {group.shipmentType === 'LAST_MILE' ? 'Last Mile' : 'Inter-Hub'}
            </Badge>
            {!group.etaFromCache && (
              <Badge variant="outline" className="text-amber-600 border-amber-400 text-xs">
                No ETA
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-500 mt-1 flex-wrap">
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {group.destinationCity}
            </span>
            <span className="flex items-center gap-1">
              <PackageCheck className="h-3 w-3" /> {group.parcelCount} parcels
            </span>
            <span className="flex items-center gap-1">
              <Weight className="h-3 w-3" /> {group.totalWeightKg.toFixed(1)} kg
            </span>
            {group.distanceKm > 0 && (
              <span className="flex items-center gap-1">
                <Truck className="h-3 w-3" /> {group.distanceKm.toFixed(0)} km
              </span>
            )}
            {group.etaSeconds > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" /> {fmtSeconds(group.etaSeconds)}
              </span>
            )}
          </div>
        </div>

        {/* Suggested vehicle badge */}
        {group.suggestedVehicleNumber ? (
          <div className="hidden sm:flex flex-col items-end text-xs text-gray-500">
            <span className="font-medium text-gray-700">{group.suggestedVehicleNumber}</span>
            <span>{group.suggestedVehicleType} · {group.suggestedVehicleCapacityKg} kg</span>
          </div>
        ) : (
          <span className="hidden sm:block text-xs text-amber-500">No vehicle</span>
        )}

        <button
          onClick={() => setExpanded(e => !e)}
          className="text-gray-400 hover:text-gray-600 p-1"
          aria-label="toggle details"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* Expandable details + overrides */}
      {expanded && (
        <div className="border-t bg-gray-50 p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-500">Departure est.</span>
              <p className="font-medium">{fmtDt(group.departureEst)}</p>
            </div>
            <div>
              <span className="text-gray-500">Arrival est.</span>
              <p className="font-medium">{fmtDt(group.arrivalEst)}</p>
            </div>
          </div>

          {/* Vehicle override */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Override vehicle ID (optional)
            </label>
            <input
              type="text"
              placeholder={group.suggestedVehicleId ?? 'UUID of vehicle'}
              value={override.vehicleId ?? ''}
              onChange={e => onChange({ vehicleId: e.target.value.trim() || undefined })}
              className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {/* Departure override */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Override departure time (optional)
            </label>
            <input
              type="datetime-local"
              value={override.departureOverride
                ? new Date(override.departureOverride).toISOString().slice(0, 16)
                : ''}
              onChange={e => onChange({
                departureOverride: e.target.value
                  ? new Date(e.target.value).toISOString()
                  : undefined,
              })}
              className="w-full border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {/* Parcel list */}
          <div>
            <span className="text-xs text-gray-500 uppercase tracking-wide">Parcel IDs</span>
            <div className="mt-1 flex flex-wrap gap-1 max-h-24 overflow-y-auto">
              {group.parcelIds.map(id => (
                <span key={id} className="bg-gray-200 rounded px-1.5 py-0.5 text-xs font-mono">
                  {id.slice(0, 8)}…
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ShipmentPlanning() {
  const { currentWarehouse, refreshData } = useWarehouse();

  const [plan, setPlan] = useState<ShipmentPlan | null>(null);
  const [generating, setGenerating] = useState(false);
  const [executing, setExecuting] = useState(false);

  // Per-group selection and overrides
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [overrides, setOverrides] = useState<Map<number, ExecuteGroupRequest>>(new Map());

  // Result
  const [result, setResult] = useState<{
    created: number; skipped: number; errors: string[];
  } | null>(null);

  const warehouseId = currentWarehouse?.id;

  // ── Generate plan ──────────────────────────────────────────────────────────

  async function handleGenerate() {
    if (!warehouseId) { toast.error('Select a warehouse first'); return; }
    setGenerating(true);
    setPlan(null);
    setResult(null);
    setSelected(new Set());
    setOverrides(new Map());
    try {
      const resp = await shipmentPlanApi.generate(warehouseId);
      if (!resp.success) { toast.error(resp.message); return; }
      setPlan(resp.data);
      // Select all groups by default
      setSelected(new Set(resp.data.groups.map(g => g.groupIndex)));
      // Initialise overrides with suggested vehicle per group
      const init = new Map<number, ExecuteGroupRequest>();
      resp.data.groups.forEach(g =>
        init.set(g.groupIndex, { groupIndex: g.groupIndex, vehicleId: g.suggestedVehicleId ?? undefined })
      );
      setOverrides(init);
      toast.success(`Plan generated: ${resp.data.totalGroups} shipment group(s)`);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to generate plan';
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  }

  // ── Execute plan ───────────────────────────────────────────────────────────

  async function handleExecute() {
    if (!warehouseId || !plan) return;
    if (selected.size === 0) { toast.error('Select at least one group to execute'); return; }
    setExecuting(true);
    try {
      const groups: ExecuteGroupRequest[] = Array.from(selected).map(idx => {
        const ov = overrides.get(idx) ?? { groupIndex: idx };
        return ov;
      });
      const resp = await shipmentPlanApi.execute(warehouseId, plan.planId, { groups });
      if (!resp.success) { toast.error(resp.message); return; }
      const { created, skipped, errors } = resp.data;
      setResult({ created, skipped, errors });
      setPlan(null);
      await refreshData?.();
      toast.success(`${created} shipment(s) created`);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to execute plan';
      toast.error(msg);
    } finally {
      setExecuting(false);
    }
  }

  // ── Toggle group selection ─────────────────────────────────────────────────

  function toggleGroup(idx: number) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  }

  function toggleAll() {
    if (!plan) return;
    setSelected(prev =>
      prev.size === plan.groups.length
        ? new Set()
        : new Set(plan.groups.map(g => g.groupIndex))
    );
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <Layout>
      <PageHeader
        title="Shipment Planning"
        subtitle={currentWarehouse ? `${currentWarehouse.name} · ${currentWarehouse.city}` : 'Select a warehouse'}
      />

      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">

        {/* Action bar */}
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            onClick={handleGenerate}
            disabled={generating || executing || !warehouseId}
          >
            {generating
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating…</>
              : <><RefreshCw className="h-4 w-4 mr-2" /> Generate Plan</>
            }
          </Button>

          {plan && (
            <Button
              variant="default"
              className="bg-green-600 hover:bg-green-700"
              onClick={handleExecute}
              disabled={executing || selected.size === 0}
            >
              {executing
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Executing…</>
                : <><Play className="h-4 w-4 mr-2" /> Execute {selected.size} group{selected.size !== 1 ? 's' : ''}</>
              }
            </Button>
          )}
        </div>

        {/* Info banner */}
        {!plan && !result && !generating && (
          <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">How it works</p>
              <p className="mt-1 text-blue-700">
                "Generate Plan" reads all <strong>AT_WAREHOUSE</strong> unshipped parcels,
                groups them by destination warehouse, bins them into vehicle loads using
                inter-city ETA from Redis, and suggests the best vehicle for each bin.
                Review the groups below, optionally override vehicle or departure time,
                then click "Execute" to create real shipments.
              </p>
            </div>
          </div>
        )}

        {/* Result card */}
        {result && (
          <div className="border rounded-lg p-6 bg-white space-y-3">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-semibold text-lg">Plan executed</span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-green-50 rounded p-3">
                <p className="text-gray-500">Created</p>
                <p className="text-2xl font-bold text-green-700">{result.created}</p>
              </div>
              <div className="bg-amber-50 rounded p-3">
                <p className="text-gray-500">Skipped</p>
                <p className="text-2xl font-bold text-amber-700">{result.skipped}</p>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded p-3 space-y-1">
                {result.errors.map((e, i) => (
                  <p key={i} className="text-xs text-red-700 flex items-start gap-1">
                    <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" /> {e}
                  </p>
                ))}
              </div>
            )}
            <Button variant="outline" size="sm" onClick={handleGenerate}>
              <RefreshCw className="h-3 w-3 mr-1" /> Plan again
            </Button>
          </div>
        )}

        {/* Plan overview */}
        {plan && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                <span className="font-medium">{plan.totalGroups}</span> group(s) ·{' '}
                <span className="font-medium">{plan.totalParcels}</span> parcel(s) ·{' '}
                generated {fmtDt(plan.generatedAt)}
                <span className="ml-2 text-amber-600 text-xs">(plan expires in 15 min)</span>
              </div>
              <button
                onClick={toggleAll}
                className="text-xs text-blue-600 hover:underline"
              >
                {selected.size === plan.groups.length ? 'Deselect all' : 'Select all'}
              </button>
            </div>

            <div className="space-y-3">
              {plan.groups.map(group => (
                <GroupCard
                  key={group.groupIndex}
                  group={group}
                  override={overrides.get(group.groupIndex) ?? { groupIndex: group.groupIndex }}
                  onChange={partial =>
                    setOverrides(prev => {
                      const next = new Map(prev);
                      next.set(group.groupIndex, {
                        ...(next.get(group.groupIndex) ?? { groupIndex: group.groupIndex }),
                        ...partial,
                      });
                      return next;
                    })
                  }
                  selected={selected.has(group.groupIndex)}
                  onToggle={() => toggleGroup(group.groupIndex)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
