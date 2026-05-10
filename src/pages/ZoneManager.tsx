import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, ToggleLeft, ToggleRight,
  RefreshCw, MapPin, Circle, Hexagon, Edit2, X, Check,
  Database,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  useZones, useCreateZone, useUpdateZone,
  useToggleZoneStatus, useDeleteZone, useRebuildZoneCache,
} from '@/hooks/useZones';
import { ZoneDrawMap } from '@/components/map/ZoneDrawMap';
import { ZoneLayer } from '@/components/map/ZoneLayer';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { ServiceZone, CreateZonePayload, LatLngPoint, ZoneShapeType, ZoneTarget } from '@/types/zone';
import { cn } from '@/lib/utils';

// ── blank form ────────────────────────────────────────────────────────────────
const blankForm = (): CreateZonePayload => ({
  name: '',
  city: '',
  description: '',
  shapeType: 'CIRCLE',
  target: 'USER',
  centerLat: undefined,
  centerLng: undefined,
  radiusMeters: 1000,
  polygonPoints: [],
});

// ── ZoneManager ───────────────────────────────────────────────────────────────

export default function ZoneManager() {
  const { data: zones = [], isLoading, refetch } = useZones();
  const createZone   = useCreateZone();
  const updateZone   = useUpdateZone();
  const toggleStatus = useToggleZoneStatus();
  const deleteZone   = useDeleteZone();
  const rebuildCache = useRebuildZoneCache();

  const [selectedZone, setSelectedZone] = useState<ServiceZone | null>(null);
  const [editing, setEditing]           = useState(false);
  const [form, setForm]                 = useState<CreateZonePayload>(blankForm());
  const [drawMode, setDrawMode]         = useState<'CIRCLE' | 'POLYGON' | 'VIEW'>('VIEW');

  // ── Select an existing zone ───────────────────────────────────────────────
  function handleSelectZone(zone: ServiceZone) {
    setSelectedZone(zone);
    setEditing(false);
    setDrawMode('VIEW');
    setForm({
      name:          zone.name,
      city:          zone.city,
      description:   zone.description ?? '',
      shapeType:     zone.shapeType,
      target:        zone.target,
      centerLat:     zone.centerLat,
      centerLng:     zone.centerLng,
      radiusMeters:  zone.radiusMeters,
      polygonPoints: zone.polygonPoints ?? [],
    });
  }

  // ── Start creating a new zone ─────────────────────────────────────────────
  function handleNew() {
    const f = blankForm();
    setForm(f);
    setSelectedZone(null);
    setEditing(true);
    setDrawMode('CIRCLE');
  }

  // ── Start editing selected zone ───────────────────────────────────────────
  function handleEdit() {
    if (!selectedZone) return;
    setEditing(true);
    setDrawMode(selectedZone.shapeType);
  }

  // ── Cancel editing ────────────────────────────────────────────────────────
  function handleCancel() {
    setEditing(false);
    setDrawMode(selectedZone ? 'VIEW' : 'VIEW');
    if (!selectedZone) setForm(blankForm());
  }

  // ── Save (create or update) ───────────────────────────────────────────────
  async function handleSave() {
    const payload: CreateZonePayload = {
      ...form,
      polygonPoints: form.shapeType === 'POLYGON' ? (form.polygonPoints ?? []) : undefined,
      centerLat:     form.shapeType === 'CIRCLE'  ? form.centerLat    : undefined,
      centerLng:     form.shapeType === 'CIRCLE'  ? form.centerLng    : undefined,
      radiusMeters:  form.shapeType === 'CIRCLE'  ? form.radiusMeters : undefined,
    };

    if (selectedZone) {
      await updateZone.mutateAsync({ id: selectedZone.id, payload });
    } else {
      await createZone.mutateAsync(payload);
    }
    setEditing(false);
    setDrawMode('VIEW');
  }

  // ── Map draw callbacks ────────────────────────────────────────────────────
  function onCenterSet(p: LatLngPoint) {
    setForm(f => ({ ...f, centerLat: p.lat, centerLng: p.lng }));
  }

  function onPointAdded(p: LatLngPoint) {
    setForm(f => ({ ...f, polygonPoints: [...(f.polygonPoints ?? []), p] }));
  }

  function removeLastVertex() {
    setForm(f => ({ ...f, polygonPoints: (f.polygonPoints ?? []).slice(0, -1) }));
  }

  // ── Shape type change ─────────────────────────────────────────────────────
  function onShapeChange(v: ZoneShapeType) {
    setForm(f => ({ ...f, shapeType: v, polygonPoints: [], centerLat: undefined, centerLng: undefined }));
    setDrawMode(v);
  }

  const saving = createZone.isPending || updateZone.isPending;

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="bg-card border-b border-border px-4 py-2 flex items-center gap-3 shrink-0">
        <Link to="/dashboard">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-primary" />
          <div>
            <p className="font-bold text-sm leading-none">Service Zones</p>
            <p className="text-xs text-muted-foreground">Manage delivery coverage areas</p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline" size="sm"
            onClick={() => rebuildCache.mutate()}
            disabled={rebuildCache.isPending}
            className="gap-1.5 h-8"
          >
            <Database className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Rebuild Cache</span>
          </Button>
          <Button
            variant="outline" size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
            className="gap-1.5 h-8"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button size="sm" onClick={handleNew} className="gap-1.5 h-8">
            <Plus className="w-3.5 h-3.5" />
            New Zone
          </Button>
        </div>
      </header>

      {/* ── Main split ────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left panel: list + form ──────────────────────────────────── */}
        <div className="w-80 xl:w-96 border-r border-border flex flex-col overflow-hidden shrink-0">

          {/* Zone list */}
          {!editing && (
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-2">
                {isLoading && (
                  <p className="text-xs text-muted-foreground text-center py-6">Loading…</p>
                )}
                {!isLoading && zones.length === 0 && (
                  <div className="text-center py-10 text-muted-foreground">
                    <MapPin className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No zones yet. Create one!</p>
                  </div>
                )}
                {zones.map(z => (
                  <ZoneListCard
                    key={z.id}
                    zone={z}
                    selected={selectedZone?.id === z.id}
                    onSelect={() => handleSelectZone(z)}
                    onToggle={() => toggleStatus.mutate(z.id)}
                    onDelete={() => {
                      if (confirm(`Delete zone "${z.name}"?`)) {
                        deleteZone.mutate(z.id);
                        if (selectedZone?.id === z.id) setSelectedZone(null);
                      }
                    }}
                  />
                ))}
              </div>
            </ScrollArea>
          )}

          {/* Detail / Edit form */}
          {!editing && selectedZone && (
            <div className="border-t border-border p-3 shrink-0">
              <Button
                variant="outline" size="sm"
                className="w-full gap-1.5"
                onClick={handleEdit}
              >
                <Edit2 className="w-3.5 h-3.5" />
                Edit Zone
              </Button>
            </div>
          )}

          {editing && (
            <ZoneForm
              form={form}
              setForm={setForm}
              onShapeChange={onShapeChange}
              onSave={handleSave}
              onCancel={handleCancel}
              saving={saving}
              onRemoveLastVertex={removeLastVertex}
            />
          )}
        </div>

        {/* ── Right panel: map ─────────────────────────────────────────── */}
        <div className="flex-1 relative">
          {editing ? (
            <ZoneDrawMap
              mode={drawMode}
              centerLat={form.centerLat}
              centerLng={form.centerLng}
              radiusMeters={form.radiusMeters}
              polygonPoints={form.polygonPoints}
              onCenterSet={onCenterSet}
              onPointAdded={onPointAdded}
              existingZones={zones}
              selectedZoneId={selectedZone?.id}
            />
          ) : (
            <MapContainer
              center={[28.6139, 77.209]}
              zoom={11}
              className="w-full h-full"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <ZoneLayer
                zones={zones}
                selectedId={selectedZone?.id}
                onSelect={handleSelectZone}
              />
            </MapContainer>
          )}

          {/* Draw mode hint */}
          {editing && drawMode !== 'VIEW' && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000]
              bg-card/90 backdrop-blur-sm border border-border rounded-xl
              px-4 py-2.5 text-sm text-muted-foreground shadow-lg flex items-center gap-2">
              {drawMode === 'CIRCLE'
                ? <><Circle className="w-3.5 h-3.5 text-amber-500" /> Click map to set circle center</>
                : <><Hexagon className="w-3.5 h-3.5 text-indigo-400" /> Click map to add polygon vertices</>
              }
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── ZoneListCard ──────────────────────────────────────────────────────────────

function ZoneListCard({
  zone, selected, onSelect, onToggle, onDelete,
}: {
  zone: ServiceZone;
  selected: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const targetColor = zone.target === 'USER'
    ? 'text-indigo-400'
    : zone.target === 'SELLER'
      ? 'text-amber-400'
      : 'text-green-400';

  return (
    <div
      className={cn(
        'bg-card border rounded-xl overflow-hidden cursor-pointer transition-colors',
        selected ? 'border-primary' : 'border-border hover:border-muted-foreground/40',
      )}
      onClick={onSelect}
    >
      <div className="p-3 flex items-start gap-2.5">
        <div className={cn(
          'mt-0.5 shrink-0',
          zone.shapeType === 'CIRCLE' ? 'text-amber-400' : 'text-indigo-400',
        )}>
          {zone.shapeType === 'CIRCLE'
            ? <Circle className="w-4 h-4" />
            : <Hexagon className="w-4 h-4" />
          }
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{zone.name}</p>
          <p className="text-xs text-muted-foreground">{zone.city}</p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <Badge
              variant={zone.status === 'ACTIVE' ? 'default' : 'secondary'}
              className="text-[10px] px-1.5 py-0"
            >
              {zone.status}
            </Badge>
            <span className={cn('text-[10px] font-semibold', targetColor)}>
              {zone.target}
            </span>
            {zone.shapeType === 'CIRCLE' && zone.radiusMeters && (
              <span className="text-[10px] text-muted-foreground">
                r={zone.radiusMeters}m
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
          <Button
            variant="ghost" size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={onToggle}
            title={zone.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
          >
            {zone.status === 'ACTIVE'
              ? <ToggleRight className="w-4 h-4 text-green-500" />
              : <ToggleLeft className="w-4 h-4" />
            }
          </Button>
          <Button
            variant="ghost" size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={onDelete}
            title="Delete zone"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── ZoneForm ──────────────────────────────────────────────────────────────────

function ZoneForm({
  form, setForm, onShapeChange, onSave, onCancel, saving, onRemoveLastVertex,
}: {
  form: CreateZonePayload;
  setForm: React.Dispatch<React.SetStateAction<CreateZonePayload>>;
  onShapeChange: (v: ZoneShapeType) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  onRemoveLastVertex: () => void;
}) {
  const set = <K extends keyof CreateZonePayload>(k: K, v: CreateZonePayload[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const canSave = form.name.trim() && form.city.trim() &&
    (form.shapeType === 'CIRCLE'
      ? form.centerLat != null && form.centerLng != null
      : (form.polygonPoints?.length ?? 0) >= 3);

  return (
    <ScrollArea className="flex-1">
      <div className="p-4 space-y-4">
        <p className="font-semibold text-sm">
          {form.name ? `Editing: ${form.name}` : 'New Zone'}
        </p>

        {/* Name */}
        <div className="space-y-1.5">
          <Label className="text-xs">Zone Name *</Label>
          <Input
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder="e.g. South Delhi Delivery Area"
            className="h-8 text-sm"
          />
        </div>

        {/* City */}
        <div className="space-y-1.5">
          <Label className="text-xs">City *</Label>
          <Input
            value={form.city}
            onChange={e => set('city', e.target.value)}
            placeholder="e.g. Delhi"
            className="h-8 text-sm"
          />
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <Label className="text-xs">Description</Label>
          <Input
            value={form.description ?? ''}
            onChange={e => set('description', e.target.value)}
            placeholder="Optional notes"
            className="h-8 text-sm"
          />
        </div>

        {/* Shape */}
        <div className="space-y-1.5">
          <Label className="text-xs">Shape *</Label>
          <Select
            value={form.shapeType}
            onValueChange={v => onShapeChange(v as ZoneShapeType)}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CIRCLE">Circle</SelectItem>
              <SelectItem value="POLYGON">Polygon</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Target */}
        <div className="space-y-1.5">
          <Label className="text-xs">Target *</Label>
          <Select
            value={form.target}
            onValueChange={v => set('target', v as ZoneTarget)}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USER">User (buyers)</SelectItem>
              <SelectItem value="SELLER">Seller (shops)</SelectItem>
              <SelectItem value="BOTH">Both</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* CIRCLE fields */}
        {form.shapeType === 'CIRCLE' && (
          <>
            <div className="bg-muted/30 rounded-lg p-3 text-xs text-muted-foreground space-y-1.5">
              <p className="font-semibold text-foreground">Circle center</p>
              <p>Click on the map to set the center point.</p>
              {form.centerLat != null && (
                <p className="font-mono">
                  {form.centerLat.toFixed(5)}, {form.centerLng?.toFixed(5)}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Radius (metres) *</Label>
              <Input
                type="number"
                min={100}
                step={100}
                value={form.radiusMeters ?? 1000}
                onChange={e => set('radiusMeters', Number(e.target.value))}
                className="h-8 text-sm"
              />
            </div>
          </>
        )}

        {/* POLYGON fields */}
        {form.shapeType === 'POLYGON' && (
          <div className="space-y-2">
            <div className="bg-muted/30 rounded-lg p-3 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground mb-1">
                Polygon vertices ({form.polygonPoints?.length ?? 0})
              </p>
              <p>Click on the map to add vertices. Minimum 3 required.</p>
            </div>

            {(form.polygonPoints?.length ?? 0) > 0 && (
              <div className="space-y-1 max-h-32 overflow-y-auto text-xs font-mono">
                {form.polygonPoints?.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 text-muted-foreground">
                    <span className="w-5 text-right shrink-0">{i + 1}.</span>
                    <span>{p.lat.toFixed(5)}, {p.lng.toFixed(5)}</span>
                  </div>
                ))}
              </div>
            )}

            {(form.polygonPoints?.length ?? 0) > 0 && (
              <Button
                variant="outline" size="sm"
                className="w-full h-7 text-xs gap-1"
                onClick={onRemoveLastVertex}
              >
                <X className="w-3 h-3" /> Remove last vertex
              </Button>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            size="sm" className="flex-1 gap-1.5"
            onClick={onSave}
            disabled={!canSave || saving}
          >
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            {saving ? 'Saving…' : 'Save Zone'}
          </Button>
          <Button
            variant="outline" size="sm" className="gap-1.5"
            onClick={onCancel}
          >
            <X className="w-3.5 h-3.5" /> Cancel
          </Button>
        </div>
      </div>
    </ScrollArea>
  );
}
