import { useState, useCallback, useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Package, MapPin, Loader2, User,
  RefreshCw, Route, ArrowRight, CheckCircle2, Clock, Users,
} from 'lucide-react';
import { useWarehouse } from '@/context/WarehouseContext';
import { Layout } from '@/components/Layout';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import {
  parcelApi, shipmentApi, orderApi,
  BackendParcel, BackendShipment, BackendOrder,
} from '@/services/api';
import type { Warehouse } from '@/types/warehouse';
import { ApiError } from '@/lib/apiClient';
import { toast } from 'sonner';

// ─── Route timeline builder ───────────────────────────────────────────────────

type StepStatus = 'completed' | 'active' | 'pending';

interface RouteStep {
  label: string;
  sublabel: string;
  timestamp?: string;
  status: StepStatus;
  shipmentId?: string;
}

const STATUS_ORDER = [
  'CREATED', 'AWAITING_PICKUP', 'PICKED_BY_RIDER', 'AT_WAREHOUSE',
  'IN_SHIPMENT', 'IN_TRANSIT', 'AT_DEST_WAREHOUSE', 'OUT_FOR_DELIVERY',
  'DELIVERED', 'RETURNED', 'FAILED',
];

function isOrAfter(current: string, threshold: string): boolean {
  return STATUS_ORDER.indexOf(current) >= STATUS_ORDER.indexOf(threshold);
}

function buildRouteFromParcel(
  parcel: BackendParcel,
  warehouseMap: Record<string, Warehouse>,
): RouteStep[] {
  const origin = warehouseMap[parcel.originWarehouseId];
  const dest = warehouseMap[parcel.destinationWarehouseId];
  const s = parcel.status;

  const steps: RouteStep[] = [
    {
      label: 'Order Created',
      sublabel: `Seller → ${origin?.city ?? 'Origin warehouse'}`,
      timestamp: parcel.createdAt,
      status: 'completed',
    },
    {
      label: 'Picked up from Seller',
      sublabel: parcel.sellerPickupOtpVerified
        ? `OTP verified · en route to ${origin?.city ?? 'warehouse'}`
        : 'Awaiting rider pickup',
      timestamp: parcel.pickedAt ?? undefined,
      status: parcel.sellerPickupOtpVerified
        ? 'completed'
        : isOrAfter(s, 'PICKED_BY_RIDER') ? 'active' : 'pending',
    },
    {
      label: `Arrived at ${origin?.city ?? 'Origin'} Warehouse`,
      sublabel: origin?.name ?? parcel.originWarehouseId.slice(0, 8),
      timestamp: parcel.arrivedAtWarehouseAt ?? undefined,
      status: parcel.warehouseInOtpVerified
        ? 'completed'
        : s === 'AT_WAREHOUSE' ? 'active'
        : isOrAfter(s, 'IN_SHIPMENT') ? 'completed' : 'pending',
    },
  ];

  const multiHop = parcel.originWarehouseId !== parcel.destinationWarehouseId;
  if (multiHop) {
    steps.push({
      label: 'In Transit',
      sublabel: `${origin?.city ?? 'Origin'} → ${dest?.city ?? 'Destination'}`,
      status: ['IN_SHIPMENT', 'IN_TRANSIT'].includes(s)
        ? 'active'
        : isOrAfter(s, 'AT_DEST_WAREHOUSE') ? 'completed' : 'pending',
      shipmentId: parcel.shipmentId ?? undefined,
    });
    steps.push({
      label: `At ${dest?.city ?? 'Destination'} Warehouse`,
      sublabel: dest?.name ?? parcel.destinationWarehouseId.slice(0, 8),
      status: s === 'AT_DEST_WAREHOUSE'
        ? 'active'
        : isOrAfter(s, 'OUT_FOR_DELIVERY') ? 'completed' : 'pending',
    });
  }

  steps.push({
    label: 'Out for Delivery',
    sublabel: 'Last-mile rider dispatched to customer',
    status: s === 'OUT_FOR_DELIVERY'
      ? 'active'
      : isOrAfter(s, 'DELIVERED') ? 'completed' : 'pending',
  });

  steps.push({
    label: 'Delivered to Customer',
    sublabel: parcel.customerDeliveryOtpVerified
      ? 'OTP verified · Delivered'
      : s === 'DELIVERED' ? 'Delivered' : 'Pending delivery',
    timestamp: parcel.deliveredAt ?? undefined,
    status: parcel.customerDeliveryOtpVerified || s === 'DELIVERED' ? 'completed' : 'pending',
  });

  return steps;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReceiveOrders() {
  const { currentWarehouse, warehouses } = useWarehouse();

  // Inventory
  const [orders, setOrders] = useState<BackendOrder[]>([]);
  const [parcels, setParcels] = useState<BackendParcel[]>([]);
  const [shipments, setShipments] = useState<BackendShipment[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [trackingParcel, setTrackingParcel] = useState<BackendParcel | null>(null);

  const warehouseId = currentWarehouse?.id;
  const warehouseMap = Object.fromEntries(warehouses.map(w => [w.id, w]));

  // ── Inventory ──────────────────────────────────────────────────────────────

  const loadInventory = useCallback(async () => {
    if (!warehouseId) return;
    setLoadingInventory(true);
    try {
      const [o, p, s] = await Promise.all([
        orderApi.getByWarehouse(warehouseId),
        parcelApi.getByWarehouse(warehouseId),
        shipmentApi.getByWarehouse(warehouseId),
      ]);
      setOrders(o.data ?? []);
      setParcels(p.data ?? []);
      setShipments(s.data ?? []);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to load inventory');
    } finally {
      setLoadingInventory(false);
    }
  }, [warehouseId]);

  useEffect(() => { loadInventory(); }, [loadInventory]);

  // ── Derived counts ─────────────────────────────────────────────────────────

  const atWarehouse = parcels.filter(p => p.status === 'AT_WAREHOUSE').length;
  const inTransit = parcels.filter(p => ['IN_SHIPMENT', 'IN_TRANSIT'].includes(p.status)).length;
  const activeShipments = shipments.filter(s =>
    ['CREATED', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'].includes(s.status)
  ).length;

  return (
    <Layout>
      <PageHeader
        title="Receive Orders"
        subtitle="Verify OTP from the rider to check in orders. View current inventory and track parcel routes below."
        backTo="/dashboard"
      />

      <div className="space-y-10">

        {/* ── Batch handover shortcut ── */}
        <Link
          to="/batch-receive"
          className="flex items-center gap-4 p-4 bg-primary/5 border border-primary/20 rounded-xl hover:bg-primary/10 transition-colors group"
        >
          <div className="p-3 bg-primary/10 rounded-lg shrink-0">
            <Users className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">Batch Handover (Recommended)</p>
            <p className="text-xs text-muted-foreground">
              One OTP per rider · scan each package · confirm all at once
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-primary shrink-0 group-hover:translate-x-1 transition-transform" />
        </Link>

        {/* ── Warehouse Inventory ── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Warehouse Inventory</h2>
              <p className="text-sm text-muted-foreground">
                {currentWarehouse?.name} · {currentWarehouse?.city}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={loadInventory} disabled={loadingInventory}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loadingInventory ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Summary chips */}
          <div className="flex flex-wrap gap-3">
            <StatChip label="Orders" value={orders.length} color="bg-violet-500/10 text-violet-700" />
            <StatChip label="Total Parcels" value={parcels.length} color="bg-primary/10 text-primary" />
            <StatChip label="At Warehouse" value={atWarehouse} color="bg-sky-500/10 text-sky-600" />
            <StatChip label="In Transit" value={inTransit} color="bg-indigo-500/10 text-indigo-600" />
            <StatChip label="Shipments" value={shipments.length} color="bg-muted text-muted-foreground" />
            <StatChip label="Active Shipments" value={activeShipments} color="bg-amber-500/10 text-amber-700" />
          </div>

          <Tabs defaultValue="orders">
            <TabsList>
              <TabsTrigger value="orders">Orders ({orders.length})</TabsTrigger>
              <TabsTrigger value="parcels">Parcels ({parcels.length})</TabsTrigger>
              <TabsTrigger value="shipments">Shipments ({shipments.length})</TabsTrigger>
            </TabsList>

            {/* ── Orders table ── */}
            <TabsContent value="orders" className="mt-4">
              {loadingInventory ? (
                <div className="flex items-center justify-center gap-2 text-muted-foreground p-10">
                  <Loader2 className="w-5 h-5 animate-spin" /><span>Loading orders…</span>
                </div>
              ) : orders.length === 0 ? (
                <div className="text-center text-muted-foreground p-12 border border-dashed rounded-xl">
                  No orders linked to this warehouse yet.
                </div>
              ) : (
                <div className="border rounded-xl overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <Th>Order No</Th>
                        <Th>Origin</Th>
                        <Th>Destination</Th>
                        <Th>Weight</Th>
                        <Th>Service</Th>
                        <Th>Priority</Th>
                        <Th>Status</Th>
                        <Th>Placed At</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {orders.map(o => (
                        <tr key={o.id} className="hover:bg-muted/30 transition-colors">
                          <Td>
                            {o.riderId ? (
                              <HoverCard openDelay={150} closeDelay={100}>
                                <HoverCardTrigger asChild>
                                  <span className="font-mono text-xs font-semibold cursor-pointer underline decoration-dashed underline-offset-2 decoration-muted-foreground/50">
                                    {o.orderNo}
                                  </span>
                                </HoverCardTrigger>
                                <HoverCardContent side="right" align="start" className="w-64 p-0 overflow-hidden">
                                  <RiderCard order={o} />
                                </HoverCardContent>
                              </HoverCard>
                            ) : (
                              <span className="font-mono text-xs font-semibold">{o.orderNo}</span>
                            )}
                          </Td>
                          <Td>
                            <div>
                              <p className="text-xs font-medium">{o.originCity}</p>
                              <p className="text-xs text-muted-foreground truncate max-w-[140px]">{o.originAddress}</p>
                            </div>
                          </Td>
                          <Td>
                            <div>
                              <p className="text-xs font-medium">{o.destCity}</p>
                              <p className="text-xs text-muted-foreground truncate max-w-[140px]">{o.destAddress}</p>
                            </div>
                          </Td>
                          <Td>{o.weightKg.toFixed(1)} kg</Td>
                          <Td>
                            <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                              o.serviceType === 'EXPRESS'
                                ? 'bg-amber-500/15 text-amber-700'
                                : 'bg-muted text-muted-foreground'
                            }`}>
                              {o.serviceType}
                            </span>
                          </Td>
                          <Td>
                            <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                              o.priority === 'URGENT' ? 'bg-destructive/15 text-destructive' :
                              o.priority === 'HIGH'   ? 'bg-amber-500/15 text-amber-700' :
                              o.priority === 'LOW'    ? 'bg-muted text-muted-foreground/60' :
                                                        'bg-muted text-muted-foreground'
                            }`}>
                              {o.priority}
                            </span>
                          </Td>
                          <Td><StatusBadge status={o.status} /></Td>
                          <Td>
                            <span className="text-xs text-muted-foreground">
                              {o.placedAt ? new Date(o.placedAt).toLocaleString() : '—'}
                            </span>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            {/* ── Parcels table ── */}
            <TabsContent value="parcels" className="mt-4">
              {loadingInventory ? (
                <div className="flex items-center justify-center gap-2 text-muted-foreground p-10">
                  <Loader2 className="w-5 h-5 animate-spin" /><span>Loading parcels…</span>
                </div>
              ) : parcels.length === 0 ? (
                <div className="text-center text-muted-foreground p-12 border border-dashed rounded-xl">
                  No parcels found for this warehouse.
                </div>
              ) : (
                <div className="border rounded-xl overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <Th>Parcel ID</Th>
                        <Th>Order ID</Th>
                        <Th>Weight</Th>
                        <Th>Route</Th>
                        <Th>Status</Th>
                        <Th>OTP Checkpoints</Th>
                        <Th></Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {parcels.map(p => (
                        <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                          <Td>
                            <span className="font-mono text-xs">{p.id.slice(0, 8)}…</span>
                          </Td>
                          <Td>
                            <span className="font-mono text-xs">{p.orderId.slice(0, 8)}…</span>
                          </Td>
                          <Td>{p.weightKg.toFixed(1)} kg</Td>
                          <Td>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              {warehouseMap[p.originWarehouseId]?.city ?? '?'}
                              <ArrowRight className="w-3 h-3" />
                              {warehouseMap[p.destinationWarehouseId]?.city ?? '?'}
                            </span>
                          </Td>
                          <Td><StatusBadge status={p.status} /></Td>
                          <Td>
                            <div className="flex gap-1">
                              <OtpDot ok={p.sellerPickupOtpVerified} label="S" title="Seller pickup" />
                              <OtpDot ok={p.warehouseInOtpVerified} label="WI" title="Warehouse in" />
                              <OtpDot ok={p.warehouseOutOtpVerified} label="WO" title="Warehouse out" />
                              <OtpDot ok={p.customerDeliveryOtpVerified} label="C" title="Customer delivery" />
                            </div>
                          </Td>
                          <Td>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs h-7 px-2 gap-1"
                              onClick={() => setTrackingParcel(p)}
                            >
                              <Route className="w-3 h-3" />
                              Track
                            </Button>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            {/* ── Shipments table ── */}
            <TabsContent value="shipments" className="mt-4">
              {loadingInventory ? (
                <div className="flex items-center justify-center gap-2 text-muted-foreground p-10">
                  <Loader2 className="w-5 h-5 animate-spin" /><span>Loading shipments…</span>
                </div>
              ) : shipments.length === 0 ? (
                <div className="text-center text-muted-foreground p-12 border border-dashed rounded-xl">
                  No shipments found for this warehouse.
                </div>
              ) : (
                <div className="border rounded-xl overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <Th>Shipment No</Th>
                        <Th>Type</Th>
                        <Th>Route</Th>
                        <Th>Parcels</Th>
                        <Th>Departure</Th>
                        <Th>Arrival Est.</Th>
                        <Th>Status</Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {shipments.map(s => (
                        <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                          <Td>
                            <span className="font-mono text-xs font-semibold">{s.shipmentNo}</span>
                          </Td>
                          <Td>
                            <span className="text-xs">{s.shipmentType.replace(/_/g, ' ')}</span>
                          </Td>
                          <Td>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              {s.originCity}
                              <ArrowRight className="w-3 h-3" />
                              {s.destinationCity}
                            </span>
                          </Td>
                          <Td>{s.parcels?.length ?? 0}</Td>
                          <Td>
                            {s.departureTimeEst
                              ? <span className="text-xs">{new Date(s.departureTimeEst).toLocaleString()}</span>
                              : <span className="text-xs text-muted-foreground">—</span>}
                          </Td>
                          <Td>
                            {s.arrivalTimeEst
                              ? <span className="text-xs">{new Date(s.arrivalTimeEst).toLocaleString()}</span>
                              : <span className="text-xs text-muted-foreground">—</span>}
                          </Td>
                          <Td><StatusBadge status={s.status} /></Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Route tracking modal */}
      {trackingParcel && (
        <RouteTrackingModal
          parcel={trackingParcel}
          warehouseMap={warehouseMap}
          onClose={() => setTrackingParcel(null)}
        />
      )}
    </Layout>
  );
}

// ─── Rider Card (shown inside HoverCard) ─────────────────────────────────────

function RiderCard({ order }: { order: BackendOrder }) {
  const isActive = order.riderStatus === 'ACTIVE';

  return (
    <div className="text-sm">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 bg-primary/5 border-b">
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <User className="w-4 h-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold truncate">{order.riderName ?? 'Rider'}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? 'bg-success' : 'bg-muted-foreground/40'}`} />
            <span className="text-xs text-muted-foreground">{order.riderStatus ?? '—'}</span>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="p-4 space-y-2.5">
        <RiderDetail icon={<Package className="w-3.5 h-3.5" />} label="Assigned to" value={order.orderNo} mono />
        {order.riderPhone && (
          <RiderDetail icon={<MapPin className="w-3.5 h-3.5" />} label="Phone" value={order.riderPhone} mono />
        )}
        {order.riderCity && (
          <RiderDetail icon={<MapPin className="w-3.5 h-3.5" />} label="City" value={order.riderCity} />
        )}
        {order.riderLat != null && order.riderLng != null && (
          <RiderDetail
            icon={<MapPin className="w-3.5 h-3.5" />}
            label="Last location"
            value={`${order.riderLat.toFixed(4)}, ${order.riderLng.toFixed(4)}`}
            mono
          />
        )}

        {/* Route summary */}
        <div className="pt-2 border-t mt-2">
          <p className="text-xs text-muted-foreground mb-1">Delivery route</p>
          <div className="flex items-center gap-1.5 text-xs font-medium">
            <span className="truncate">{order.originCity}</span>
            <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
            <span className="truncate">{order.destCity}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{order.weightKg.toFixed(1)} kg</p>
        </div>
      </div>
    </div>
  );
}

function RiderDetail({
  icon, label, value, mono = false,
}: {
  icon: ReactNode; label: string; value: string; mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground leading-none mb-0.5">{label}</p>
        <p className={`text-xs font-medium truncate ${mono ? 'font-mono' : ''}`}>{value}</p>
      </div>
    </div>
  );
}

// ─── Route Tracking Modal ─────────────────────────────────────────────────────

function RouteTrackingModal({
  parcel,
  warehouseMap,
  onClose,
}: {
  parcel: BackendParcel;
  warehouseMap: Record<string, Warehouse>;
  onClose: () => void;
}) {
  const steps = buildRouteFromParcel(parcel, warehouseMap);
  const origin = warehouseMap[parcel.originWarehouseId];
  const dest = warehouseMap[parcel.destinationWarehouseId];

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Route className="w-5 h-5 text-primary" />
            Route Timeline
          </DialogTitle>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-1">
            <span className="font-mono">Parcel {parcel.id.slice(0, 8)}…</span>
            <span className="font-mono">Order {parcel.orderId.slice(0, 8)}…</span>
            <StatusBadge status={parcel.status} />
          </div>

          {/* Route summary bar */}
          <div className="mt-3 flex items-center gap-2 p-3 bg-muted/50 rounded-lg text-sm">
            <span className="font-medium">{origin?.city ?? '?'}</span>
            <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="font-medium">{dest?.city ?? '?'}</span>
            <span className="ml-auto text-xs text-muted-foreground">{parcel.weightKg.toFixed(1)} kg</span>
          </div>
        </DialogHeader>

        {/* Vertical timeline */}
        <div className="relative mt-4 pl-7">
          <div className="absolute left-[13px] top-2 bottom-2 w-0.5 bg-border" />
          <div className="space-y-5">
            {steps.map((step, i) => (
              <div key={i} className="relative flex gap-4">
                {/* Node */}
                <div className={`absolute -left-7 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5
                  ${step.status === 'completed'
                    ? 'bg-success border-success'
                    : step.status === 'active'
                    ? 'bg-primary border-primary'
                    : 'bg-background border-muted-foreground/30'}`}
                >
                  {step.status === 'completed' && (
                    <CheckCircle2 className="w-3 h-3 text-white" />
                  )}
                  {step.status === 'active' && (
                    <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 pb-1">
                  <p className={`font-medium text-sm ${step.status === 'pending' ? 'text-muted-foreground' : ''}`}>
                    {step.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{step.sublabel}</p>
                  {step.shipmentId && (
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">
                      Shipment: {step.shipmentId.slice(0, 8)}…
                    </p>
                  )}
                  {step.timestamp && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(step.timestamp).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* OTP checkpoint summary */}
        <div className="mt-5 p-3 bg-muted/40 rounded-lg">
          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
            OTP Checkpoints
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <OtpCheckpoint label="Seller Pickup" verified={parcel.sellerPickupOtpVerified} />
            <OtpCheckpoint label="Warehouse In" verified={parcel.warehouseInOtpVerified} />
            <OtpCheckpoint label="Warehouse Out" verified={parcel.warehouseOutOtpVerified} />
            <OtpCheckpoint label="Customer Delivery" verified={parcel.customerDeliveryOtpVerified} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function OtpCheckpoint({ label, verified }: { label: string; verified: boolean }) {
  return (
    <div className={`flex items-center gap-2 p-2 rounded ${
      verified ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
    }`}>
      {verified
        ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        : <Clock className="w-3.5 h-3.5 shrink-0" />}
      <span>{label}</span>
    </div>
  );
}

function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${color}`}>
      <span className="text-lg font-bold leading-none">{value}</span>
      <span className="text-xs">{label}</span>
    </div>
  );
}

function Th({ children }: { children: ReactNode }) {
  return (
    <th className="text-left font-medium px-4 py-3 text-xs text-muted-foreground uppercase tracking-wide">
      {children}
    </th>
  );
}

function Td({ children }: { children: ReactNode }) {
  return <td className="px-4 py-3">{children}</td>;
}

function OtpDot({ ok, label, title }: { ok: boolean; label: string; title: string }) {
  return (
    <span
      title={`${title}: ${ok ? 'verified' : 'pending'}`}
      className={`inline-flex items-center justify-center px-1.5 h-5 rounded text-[9px] font-semibold
        ${ok ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground/50'}`}
    >
      {label}
    </span>
  );
}

