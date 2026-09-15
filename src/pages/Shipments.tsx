import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Loader2, Pencil, Trash2, Plus, Send, RefreshCw, Route } from 'lucide-react';
import { toast } from 'sonner';
import { Layout } from '@/components/Layout';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useWarehouse } from '@/context/WarehouseContext';
import { shipmentApi, BackendShipment, BackendShipmentStatus } from '@/services/api';
import { ApiError } from '@/lib/apiClient';

const STATUS_OPTIONS: BackendShipmentStatus[] = [
  'CREATED', 'ASSIGNED', 'DISPATCHED', 'IN_TRANSIT', 'AT_DESTINATION', 'DELIVERED', 'CANCELLED',
];
const TYPE_OPTIONS = ['LONG_HAUL', 'INTER_HUB', 'LAST_MILE'] as const;

const TRANSITIONS: Record<BackendShipmentStatus, BackendShipmentStatus[]> = {
  CREATED: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['DISPATCHED', 'CANCELLED'],
  DISPATCHED: ['IN_TRANSIT'],
  IN_TRANSIT: ['AT_DESTINATION'],
  AT_DESTINATION: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

export default function Shipments() {
  const { currentWarehouse, warehouses } = useWarehouse();
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = (searchParams.get('status') ?? '') as BackendShipmentStatus | '';
  const [shipments, setShipments] = useState<BackendShipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [detail, setDetail] = useState<BackendShipment | null>(null);
  const [edit, setEdit] = useState<BackendShipment | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleting, setDeleting] = useState<BackendShipment | null>(null);

  const warehouseId = currentWarehouse?.id;

  const load = useCallback(() => {
    if (!warehouseId) return;
    setLoading(true);
    shipmentApi.getByWarehouse(warehouseId, statusFilter || undefined)
      .then(res => setShipments(res.data ?? []))
      .catch((e: unknown) => toast.error(e instanceof ApiError ? e.message : 'Failed to load shipments'))
      .finally(() => setLoading(false));
  }, [warehouseId, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!search.trim()) return shipments;
    const q = search.toLowerCase();
    return shipments.filter(s =>
      s.shipmentNo?.toLowerCase().includes(q) || s.id.toLowerCase().includes(q)
    );
  }, [shipments, search]);

  const changeStatus = (next: string) => {
    if (next) setSearchParams({ status: next });
    else setSearchParams({});
  };

  const transition = async (s: BackendShipment, next: BackendShipmentStatus) => {
    try {
      await shipmentApi.updateStatus(s.id, next);
      toast.success(`Shipment → ${next}`);
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Status change failed');
    }
  };

  return (
    <Layout>
      <PageHeader
        title="Shipments"
        subtitle={`Manage shipments from ${currentWarehouse?.name ?? 'this warehouse'}`}
        backTo="/dashboard"
      />

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/shipment-planning"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 border border-blue-300 rounded-md px-3 py-1.5 hover:bg-blue-50 transition-colors"
          >
            Plan &amp; Create Shipments →
          </Link>
          <Link
            to="/dispatch-shipment"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700 hover:text-green-900 border border-green-300 rounded-md px-3 py-1.5 hover:bg-green-50 transition-colors"
          >
            Dispatch / Receive Shipments →
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor="status-filter" className="text-sm">Status</Label>
          <select
            id="status-filter" value={statusFilter} onChange={e => changeStatus(e.target.value)}
            aria-label="Filter shipments by status"
            className="text-sm border rounded px-2 py-1.5 bg-background"
          >
            <option value="">All</option>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <Input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by shipment no" className="max-w-xs h-9"
          />

          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>

          <div className="ml-auto" />

          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> New Shipment
          </Button>
        </div>

        <div className="bg-card border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <Th>No.</Th><Th>Route</Th><Th>Type</Th><Th>Parcels</Th>
                <Th>Status</Th><Th>Departs</Th><Th>Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading && (
                <tr><td colSpan={7} className="p-8 text-center">
                  <Loader2 className="w-5 h-5 animate-spin inline" />
                </td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">
                  <Send className="w-6 h-6 inline mr-2 opacity-50" />
                  No shipments {statusFilter && `in ${statusFilter} state`}
                </td></tr>
              )}
              {filtered.map(s => (
                <tr key={s.id} className="hover:bg-muted/30">
                  <Td><span className="font-mono text-xs">{s.shipmentNo ?? s.id.slice(0,8)}</span></Td>
                  <Td>{s.originCity} → {s.destinationCity}</Td>
                  <Td><span className="text-xs">{s.shipmentType}</span></Td>
                  <Td>{(s.parcels?.length ?? 0)}</Td>
                  <Td><StatusBadge status={s.status} /></Td>
                  <Td className="text-xs">{s.departureTimeEst ? new Date(s.departureTimeEst).toLocaleString() : '—'}</Td>
                  <Td>
                    <div className="flex gap-1 flex-wrap">
                      <Button size="sm" variant="ghost" onClick={() => setDetail(s)}>View</Button>
                      <Button size="sm" variant="ghost" asChild>
                        <Link to={`/track/shipment/${encodeURIComponent(s.shipmentNo ?? s.id)}`} title="Track & QR">
                          <Route className="w-3.5 h-3.5" />
                        </Link>
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEdit(s)}
                        disabled={s.status !== 'CREATED' && s.status !== 'ASSIGNED'}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost"
                        onClick={() => setDeleting(s)}
                        disabled={s.status !== 'CREATED' && s.status !== 'CANCELLED'}
                        title="Only CREATED/CANCELLED shipments can be deleted">
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                      {TRANSITIONS[s.status]?.map(next => (
                        <Button key={next} size="sm" variant="outline"
                          className="text-[10px] h-7 px-2"
                          onClick={() => transition(s, next)}>
                          → {next}
                        </Button>
                      ))}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <DetailDialog shipment={detail} onClose={() => setDetail(null)} warehouses={warehouses} />

      <EditDialog
        shipment={edit}
        onClose={() => setEdit(null)}
        onSaved={() => { setEdit(null); load(); }}
      />

      <CreateDialog
        open={createOpen}
        warehouseId={warehouseId}
        warehouses={warehouses}
        onClose={() => setCreateOpen(false)}
        onSaved={() => { setCreateOpen(false); load(); }}
      />

      <AlertDialog open={!!deleting} onOpenChange={open => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete shipment?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && <>Any parcels attached will be released back to AT_WAREHOUSE. Shipment <span className="font-mono">{deleting.shipmentNo ?? deleting.id.slice(0,8)}</span>.</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deleting) return;
                try {
                  await shipmentApi.remove(deleting.id);
                  toast.success('Shipment deleted');
                  setDeleting(null);
                  load();
                } catch (e) {
                  toast.error(e instanceof ApiError ? e.message : 'Delete failed');
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left font-medium px-3 py-2 text-xs uppercase tracking-wide">{children}</th>;
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 ${className}`}>{children}</td>;
}

function DetailDialog({
  shipment, onClose, warehouses,
}: {
  shipment: BackendShipment | null;
  onClose: () => void;
  warehouses: Array<{ id: string; name: string; city: string }>;
}) {
  const whName = (id?: string) => warehouses.find(w => w.id === id)?.name ?? id ?? '—';
  return (
    <Dialog open={!!shipment} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Shipment {shipment?.shipmentNo}</DialogTitle>
          <DialogDescription className="font-mono text-xs">{shipment?.id}</DialogDescription>
        </DialogHeader>
        {shipment && (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <DField label="Type">{shipment.shipmentType}</DField>
            <DField label="Status"><StatusBadge status={shipment.status} /></DField>
            <DField label="Origin">{whName(shipment.originWarehouseId)} ({shipment.originCity})</DField>
            <DField label="Destination">{whName(shipment.destinationWarehouseId)} ({shipment.destinationCity})</DField>
            <DField label="Vehicle">{shipment.vehicleId ?? '—'}</DField>
            <DField label="Parcels">{shipment.parcels?.length ?? 0}</DField>
            <DField label="Departs">{shipment.departureTimeEst ? new Date(shipment.departureTimeEst).toLocaleString() : '—'}</DField>
            <DField label="Arrives">{shipment.arrivalTimeEst ? new Date(shipment.arrivalTimeEst).toLocaleString() : '—'}</DField>
            <DField label="Cost">{shipment.costEstimate ? `₹${shipment.costEstimate}` : '—'}</DField>
            <DField label="Created">{new Date(shipment.createdAt).toLocaleString()}</DField>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium font-mono text-xs break-all">{children}</p>
    </div>
  );
}

function toLocalInput(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  // datetime-local expects YYYY-MM-DDTHH:mm
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function EditDialog({
  shipment, onClose, onSaved,
}: {
  shipment: BackendShipment | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [vehicleId, setVehicleId] = useState('');
  const [type, setType] = useState<typeof TYPE_OPTIONS[number]>('INTER_HUB');
  const [departure, setDeparture] = useState('');
  const [arrival, setArrival] = useState('');
  const [cost, setCost] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (shipment) {
      setVehicleId(shipment.vehicleId ?? '');
      setType((shipment.shipmentType as typeof TYPE_OPTIONS[number]) ?? 'INTER_HUB');
      setDeparture(toLocalInput(shipment.departureTimeEst));
      setArrival(toLocalInput(shipment.arrivalTimeEst));
      setCost(shipment.costEstimate != null ? String(shipment.costEstimate) : '');
    }
  }, [shipment]);

  const submit = async () => {
    if (!shipment) return;
    setBusy(true);
    try {
      await shipmentApi.update(shipment.id, {
        vehicleId: vehicleId || undefined,
        shipmentType: type,
        departureTimeEst: departure ? new Date(departure).toISOString() : undefined,
        arrivalTimeEst: arrival ? new Date(arrival).toISOString() : undefined,
        costEstimate: cost ? Number(cost) : undefined,
      });
      toast.success('Shipment updated');
      onSaved();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Update failed');
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={!!shipment} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit shipment</DialogTitle>
          <DialogDescription>Editable while in CREATED or ASSIGNED state.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="s-type">Type</Label>
            <select
              id="s-type" value={type}
              onChange={e => setType(e.target.value as typeof TYPE_OPTIONS[number])}
              aria-label="Shipment type"
              className="w-full text-sm border rounded px-2 py-1.5 bg-background"
            >
              {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="s-vehicle">Vehicle ID</Label>
            <Input id="s-vehicle" value={vehicleId} onChange={e => setVehicleId(e.target.value)} placeholder="UUID (optional)" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="s-dep">Departure</Label>
              <Input id="s-dep" type="datetime-local" value={departure} onChange={e => setDeparture(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="s-arr">Arrival</Label>
              <Input id="s-arr" type="datetime-local" value={arrival} onChange={e => setArrival(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="s-cost">Cost estimate (₹)</Label>
            <Input id="s-cost" type="number" step="1" value={cost} onChange={e => setCost(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateDialog({
  open, warehouseId, warehouses, onClose, onSaved,
}: {
  open: boolean;
  warehouseId?: string;
  warehouses: Array<{ id: string; name: string; city: string }>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [destWh, setDestWh] = useState('');
  const [type, setType] = useState<typeof TYPE_OPTIONS[number]>('INTER_HUB');
  const [departure, setDeparture] = useState('');
  const [arrival, setArrival] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setDestWh(''); setType('INTER_HUB'); setDeparture(''); setArrival('');
    }
  }, [open]);

  const submit = async () => {
    if (!warehouseId) { toast.error('No warehouse selected'); return; }
    if (!destWh) { toast.error('Pick a destination warehouse'); return; }
    setBusy(true);
    try {
      const now = new Date();
      await shipmentApi.create({
        shipmentType: type,
        originWarehouseId: warehouseId,
        destinationWarehouseId: destWh,
        departureTimeEst: (departure ? new Date(departure) : now).toISOString(),
        arrivalTimeEst: (arrival ? new Date(arrival) : new Date(now.getTime() + 24*60*60*1000)).toISOString(),
      });
      toast.success('Shipment created');
      onSaved();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Create failed');
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New shipment</DialogTitle>
          <DialogDescription>Create an empty shipment from this warehouse. Attach parcels next.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="cs-type">Type</Label>
            <select
              id="cs-type" value={type}
              onChange={e => setType(e.target.value as typeof TYPE_OPTIONS[number])}
              aria-label="Shipment type"
              className="w-full text-sm border rounded px-2 py-1.5 bg-background"
            >
              {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <Label htmlFor="cs-dest">Destination warehouse</Label>
            <select
              id="cs-dest" value={destWh} onChange={e => setDestWh(e.target.value)}
              aria-label="Destination warehouse"
              className="w-full text-sm border rounded px-2 py-1.5 bg-background"
            >
              <option value="">— Select —</option>
              {warehouses.filter(w => w.id !== warehouseId)
                .map(w => <option key={w.id} value={w.id}>{w.name} ({w.city})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="cs-dep">Departure</Label>
              <Input id="cs-dep" type="datetime-local" value={departure} onChange={e => setDeparture(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="cs-arr">Arrival</Label>
              <Input id="cs-arr" type="datetime-local" value={arrival} onChange={e => setArrival(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy ? 'Creating…' : 'Create'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
