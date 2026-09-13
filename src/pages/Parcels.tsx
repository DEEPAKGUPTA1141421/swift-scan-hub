import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, Pencil, Trash2, Plus, Package, RefreshCw } from 'lucide-react';
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
import { parcelApi, BackendParcel, BackendParcelStatus } from '@/services/api';
import { ApiError } from '@/lib/apiClient';

const STATUS_OPTIONS: BackendParcelStatus[] = [
  'CREATED', 'AWAITING_PICKUP', 'PICKED_BY_RIDER', 'AT_WAREHOUSE',
  'IN_SHIPMENT', 'IN_TRANSIT', 'AT_DEST_WAREHOUSE', 'OUT_FOR_DELIVERY',
  'DELIVERED', 'RETURNED', 'FAILED',
];

export default function Parcels() {
  const { currentWarehouse, warehouses } = useWarehouse();
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = (searchParams.get('status') ?? '') as BackendParcelStatus | '';
  const [parcels, setParcels] = useState<BackendParcel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [detail, setDetail] = useState<BackendParcel | null>(null);
  const [edit, setEdit] = useState<BackendParcel | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleting, setDeleting] = useState<BackendParcel | null>(null);

  const warehouseId = currentWarehouse?.id;

  const load = useCallback(() => {
    if (!warehouseId) return;
    setLoading(true);
    parcelApi.getByWarehouse(warehouseId, statusFilter || undefined)
      .then(res => setParcels(res.data ?? []))
      .catch((e: unknown) => toast.error(e instanceof ApiError ? e.message : 'Failed to load parcels'))
      .finally(() => setLoading(false));
  }, [warehouseId, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!search.trim()) return parcels;
    const q = search.toLowerCase();
    return parcels.filter(p =>
      p.id.toLowerCase().includes(q) || (p.orderId ?? '').toLowerCase().includes(q)
    );
  }, [parcels, search]);

  const changeStatus = (next: string) => {
    if (next) setSearchParams({ status: next });
    else setSearchParams({});
  };

  return (
    <Layout>
      <PageHeader
        title="Parcels"
        subtitle={`Manage parcels at ${currentWarehouse?.name ?? 'this warehouse'}`}
        backTo="/dashboard"
      />

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor="status-filter" className="text-sm">Status</Label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={e => changeStatus(e.target.value)}
            aria-label="Filter parcels by status"
            className="text-sm border rounded px-2 py-1.5 bg-background"
          >
            <option value="">All</option>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by parcel/order id"
            className="max-w-xs h-9"
          />

          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>

          <div className="ml-auto" />

          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> New Parcel
          </Button>
        </div>

        <div className="bg-card border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <Th>Parcel</Th><Th>Order</Th><Th>Status</Th>
                <Th>Weight</Th><Th>Description</Th><Th>Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading && (
                <tr><td colSpan={6} className="p-8 text-center">
                  <Loader2 className="w-5 h-5 animate-spin inline" />
                </td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">
                  <Package className="w-6 h-6 inline mr-2 opacity-50" />
                  No parcels {statusFilter && `in ${statusFilter} state`}
                </td></tr>
              )}
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-muted/30">
                  <Td><span className="font-mono text-xs">{p.id.slice(0, 8)}…</span></Td>
                  <Td><span className="font-mono text-xs">{p.orderId ? `${p.orderId.slice(0, 8)}…` : '—'}</span></Td>
                  <Td><StatusBadge status={p.status} /></Td>
                  <Td>{p.weightKg.toFixed(1)} kg</Td>
                  <Td className="max-w-[260px] truncate">{p.description ?? '—'}</Td>
                  <Td>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setDetail(p)}>View</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEdit(p)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm" variant="ghost"
                        onClick={() => setDeleting(p)}
                        disabled={p.status !== 'CREATED'}
                        title={p.status !== 'CREATED' ? 'Only CREATED parcels can be deleted' : 'Delete'}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <DetailDialog parcel={detail} onClose={() => setDetail(null)} warehouses={warehouses} />

      <EditDialog
        parcel={edit}
        warehouses={warehouses}
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
            <AlertDialogTitle>Delete parcel?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && <>This permanently removes parcel <span className="font-mono">{deleting.id.slice(0,8)}…</span>. Only allowed while in CREATED state.</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deleting) return;
                try {
                  await parcelApi.remove(deleting.id);
                  toast.success('Parcel deleted');
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
  parcel, onClose, warehouses,
}: {
  parcel: BackendParcel | null;
  onClose: () => void;
  warehouses: Array<{ id: string; name: string; city: string }>;
}) {
  const whName = (id?: string) => warehouses.find(w => w.id === id)?.name ?? id ?? '—';
  return (
    <Dialog open={!!parcel} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Parcel details</DialogTitle>
          <DialogDescription className="font-mono text-xs">{parcel?.id}</DialogDescription>
        </DialogHeader>
        {parcel && (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <DField label="Order">{parcel.orderId ?? '—'}</DField>
            <DField label="Status"><StatusBadge status={parcel.status} /></DField>
            <DField label="Weight">{parcel.weightKg.toFixed(2)} kg</DField>
            <DField label="Dimensions">{parcel.dimensions ?? '—'}</DField>
            <DField label="Origin WH">{whName(parcel.originWarehouseId)}</DField>
            <DField label="Current WH">{whName(parcel.currentWarehouseId)}</DField>
            <DField label="Dest WH">{whName(parcel.destinationWarehouseId)}</DField>
            <DField label="Shipment">{parcel.shipmentId ?? '—'}</DField>
            <DField label="Pickup Rider">{parcel.pickupRiderId ?? '—'}</DField>
            <DField label="Delivery Rider">{parcel.deliveryRiderId ?? '—'}</DField>
            <DField label="Created">{new Date(parcel.createdAt).toLocaleString()}</DField>
            <DField label="Delivered">{parcel.deliveredAt ? new Date(parcel.deliveredAt).toLocaleString() : '—'}</DField>
            <div className="col-span-2">
              <p className="text-xs text-muted-foreground">Description</p>
              <p>{parcel.description ?? '—'}</p>
            </div>
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

function EditDialog({
  parcel, warehouses, onClose, onSaved,
}: {
  parcel: BackendParcel | null;
  warehouses: Array<{ id: string; name: string; city: string }>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [weight, setWeight] = useState('');
  const [dims, setDims] = useState('');
  const [desc, setDesc] = useState('');
  const [destWh, setDestWh] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (parcel) {
      setWeight(String(parcel.weightKg ?? ''));
      setDims(parcel.dimensions ?? '');
      setDesc(parcel.description ?? '');
      setDestWh(parcel.destinationWarehouseId ?? '');
    }
  }, [parcel]);

  const submit = async () => {
    if (!parcel) return;
    setBusy(true);
    try {
      await parcelApi.update(parcel.id, {
        weightKg: weight ? Number(weight) : undefined,
        dimensions: dims || undefined,
        description: desc || undefined,
        destinationWarehouseId: destWh || undefined,
      });
      toast.success('Parcel updated');
      onSaved();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Update failed');
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={!!parcel} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit parcel</DialogTitle>
          <DialogDescription className="font-mono text-xs">{parcel?.id}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="p-weight">Weight (kg)</Label>
              <Input id="p-weight" type="number" step="0.1" value={weight} onChange={e => setWeight(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="p-dims">Dimensions</Label>
              <Input id="p-dims" value={dims} onChange={e => setDims(e.target.value)} placeholder="30x20x15 cm" />
            </div>
          </div>
          <div>
            <Label htmlFor="p-desc">Description</Label>
            <Input id="p-desc" value={desc} onChange={e => setDesc(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="p-dest">Destination warehouse</Label>
            <select
              id="p-dest" value={destWh} onChange={e => setDestWh(e.target.value)}
              aria-label="Destination warehouse"
              className="w-full text-sm border rounded px-2 py-1.5 bg-background"
            >
              <option value="">—</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name} ({w.city})</option>)}
            </select>
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
  const [orderId, setOrderId] = useState('');
  const [weight, setWeight] = useState('');
  const [dims, setDims] = useState('');
  const [desc, setDesc] = useState('');
  const [destWh, setDestWh] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setOrderId(''); setWeight(''); setDims(''); setDesc(''); setDestWh('');
    }
  }, [open]);

  const submit = async () => {
    if (!warehouseId) { toast.error('No warehouse selected'); return; }
    if (!orderId || !destWh) { toast.error('Order ID and destination warehouse are required'); return; }
    setBusy(true);
    try {
      await parcelApi.create({
        orderId,
        weightKg: weight ? Number(weight) : 0,
        dimensions: dims || undefined,
        description: desc || undefined,
        originWarehouseId: warehouseId,
        destinationWarehouseId: destWh,
      });
      toast.success('Parcel created');
      onSaved();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Create failed');
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New parcel</DialogTitle>
          <DialogDescription>Creates a parcel for an existing order at this warehouse.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="c-order">Order ID</Label>
            <Input id="c-order" value={orderId} onChange={e => setOrderId(e.target.value)} placeholder="UUID" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="c-weight">Weight (kg)</Label>
              <Input id="c-weight" type="number" step="0.1" value={weight} onChange={e => setWeight(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="c-dims">Dimensions</Label>
              <Input id="c-dims" value={dims} onChange={e => setDims(e.target.value)} placeholder="30x20x15 cm" />
            </div>
          </div>
          <div>
            <Label htmlFor="c-desc">Description</Label>
            <Input id="c-desc" value={desc} onChange={e => setDesc(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="c-dest">Destination warehouse</Label>
            <select
              id="c-dest" value={destWh} onChange={e => setDestWh(e.target.value)}
              aria-label="Destination warehouse"
              className="w-full text-sm border rounded px-2 py-1.5 bg-background"
            >
              <option value="">— Select —</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name} ({w.city})</option>)}
            </select>
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
