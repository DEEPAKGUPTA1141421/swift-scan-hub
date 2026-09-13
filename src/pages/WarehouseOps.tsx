import { useEffect, useMemo, useState, useCallback, type ReactNode } from "react";
import { Client, IMessage } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Legend,
} from "recharts";
import { toast } from "sonner";
import {
  Package, Truck, MapPin, Users, LayoutDashboard, Boxes, Send, RefreshCw,
  CheckCircle2, AlertCircle, Loader2, ChevronRight, ChevronDown, Menu, X,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE = "https://deliveryinventoryservice.onrender.com";
const WS_URL = `${API_BASE}/ws`;

// Hardcoded for the dashboard. In production, picked at login.
const WAREHOUSE_ID = "00000000-0000-0000-0000-000000000001";

// Default map center (Delhi); falls back if warehouse coords unavailable.
const DEFAULT_CENTER: [number, number] = [28.6139, 77.209];

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ApiResp<T> = { success: boolean; message: string; data: T; statusCode: number };

interface UnassignedOrderItem {
  id: string; orderNo: string; destAddress: string; destCity: string;
  weightKg: number; destLat: number; destLng: number;
}
interface UnassignedOrderGroup {
  destCity: string; count: number; totalWeightKg: number; orders: UnassignedOrderItem[];
}
interface ParcelResponse {
  id: string; orderId: string; weightKg: number; status: string;
  originWarehouseId: string; destinationWarehouseId: string; currentWarehouseId: string;
  shipmentId?: string; pickupRiderId?: string; deliveryRiderId?: string;
  sellerPickupOtpVerified: boolean; warehouseInOtpVerified: boolean;
  warehouseOutOtpVerified: boolean; customerDeliveryOtpVerified: boolean;
  pickedAt?: string; arrivedAtWarehouseAt?: string; deliveredAt?: string; createdAt: string;
}
interface ShipmentSuggestion {
  destWarehouseId: string; destCity: string; parcelCount: number;
  totalWeightKg: number; parcelIds: string[];
}
interface ShipmentResponse {
  id: string; shipmentNo: string; shipmentType: string;
  originCity: string; destinationCity: string;
  parcelCount: number; totalWeightKg: number; status: string;
  departureTimeEst?: string; arrivalTimeEst?: string;
}
interface VehicleSummary {
  id: string; vehicleType: string; vehicleNumber: string;
  capacityKg: number; maxParcels: number; status: string;
}
interface RouteAssignmentStop {
  assignmentId: string; orderId: string; sequenceNumber: number; status: string;
  destAddress: string; destCity: string; destLat: number; destLng: number; weightKg: number;
}
interface RiderBundle {
  riderId: string; riderName: string; riderPhone?: string;
  currentLat: number; currentLng: number;
  totalStops: number; completed: number; assignments: RouteAssignmentStop[];
}
interface DashboardCounts {
  warehouseId: string; warehouseName: string; city: string;
  parcelsCreated: number; parcelsAwaitingPickup: number; parcelsAtWarehouse: number;
  parcelsInShipment: number; parcelsOutForDelivery: number; parcelsDelivered: number;
  shipmentsCreated: number; shipmentsInTransit: number; shipmentsArrived: number;
  activeRiders: number;
}
interface RiderLive {
  riderId: string; lat: number; lng: number; speedKph?: number; heading?: number;
  name?: string; status?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// API helpers
// ─────────────────────────────────────────────────────────────────────────────

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const json = (await res.json()) as ApiResp<T>;
  if (!res.ok || !json.success) {
    throw new Error(json.message || `HTTP ${res.status}`);
  }
  return json.data;
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

type Tab = "overview" | "orders" | "shipments" | "riders" | "live";

const TABS: { key: Tab; label: string; icon: any }[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "orders", label: "Orders → Parcels", icon: Boxes },
  { key: "shipments", label: "Parcels → Shipments", icon: Send },
  { key: "riders", label: "Riders & Routes", icon: Users },
  { key: "live", label: "Live Map", icon: MapPin },
];

export default function WarehouseOps() {
  const [tab, setTab] = useState<Tab>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [riders, setRiders] = useState<Map<string, RiderLive>>(new Map());

  // ── WebSocket: keep rider GPS map fresh ───────────────────────────────────
  useEffect(() => {
    const client = new Client({
      webSocketFactory: () => new SockJS(WS_URL) as any,
      reconnectDelay: 5000,
      onConnect: () => {
        client.subscribe(`/topic/warehouse/${WAREHOUSE_ID}/live`, (msg: IMessage) => {
          try {
            const evt = JSON.parse(msg.body);
            if (evt.type === "RIDER_LOCATION" && evt.riderId) {
              setRiders((prev) => {
                const next = new Map(prev);
                next.set(evt.riderId, {
                  riderId: evt.riderId,
                  lat: evt.lat, lng: evt.lng,
                  speedKph: evt.speedKph, heading: evt.heading,
                  name: evt.name, status: evt.status ?? "active",
                });
                return next;
              });
            } else if (evt.type === "ORDER_STATUS") {
              toast.message(`Order ${evt.orderNo ?? evt.orderId} → ${evt.status}`);
            } else if (evt.type === "VRP_COMPLETE") {
              toast.success(`VRP batch complete: ${evt.assigned ?? "?"} stops assigned`);
            }
          } catch {/* ignore malformed frames */}
        });
      },
      onStompError: (f) => console.warn("STOMP error", f.headers?.message),
    });
    client.activate();
    return () => { client.deactivate(); };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? "w-64" : "w-16"} hidden md:flex transition-all duration-200 bg-slate-900 text-slate-100 flex-col`}>
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800">
          {sidebarOpen && <span className="font-semibold tracking-wide">Warehouse Ops</span>}
          <button onClick={() => setSidebarOpen((s) => !s)}
            aria-label="Toggle sidebar" title="Toggle sidebar"
            className="p-1 hover:bg-slate-800 rounded">
            <Menu className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 py-3 space-y-1 px-2">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm
                ${tab === key ? "bg-slate-800 text-white" : "text-slate-300 hover:bg-slate-800/60"}`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {sidebarOpen && <span className="truncate">{label}</span>}
            </button>
          ))}
        </nav>
        <div className="p-3 text-[10px] text-slate-500 border-t border-slate-800">
          {sidebarOpen && <>Warehouse<br /><span className="text-slate-400 font-mono break-all">{WAREHOUSE_ID.slice(0, 8)}…</span></>}
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-slate-900 text-slate-100 grid grid-cols-5 border-t border-slate-800">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex flex-col items-center py-2 text-[10px] ${tab === key ? "text-white" : "text-slate-400"}`}>
            <Icon className="h-4 w-4 mb-1" />
            {label.split(" ")[0]}
          </button>
        ))}
      </nav>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b flex items-center justify-between px-6">
          <h1 className="text-lg font-semibold">{TABS.find((t) => t.key === tab)?.label}</h1>
          <span className="text-xs text-slate-500">Live · {new Date().toLocaleTimeString()}</span>
        </header>
        <section className="flex-1 p-4 md:p-6 overflow-auto pb-20 md:pb-6">
          {tab === "overview" && <OverviewTab riders={riders} />}
          {tab === "orders" && <OrdersTab />}
          {tab === "shipments" && <ShipmentsTab />}
          {tab === "riders" && <RidersTab riders={riders} />}
          {tab === "live" && <LiveMapTab riders={riders} />}
        </section>
      </main>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Tab 1: OVERVIEW
// ═════════════════════════════════════════════════════════════════════════════

function OverviewTab({ riders }: { riders: Map<string, RiderLive> }) {
  const [counts, setCounts] = useState<DashboardCounts | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    api<DashboardCounts>(`/api/v1/admin/warehouse/${WAREHOUSE_ID}/dashboard`)
      .then(setCounts).catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 15000);
    return () => clearInterval(t);
  }, [refresh]);

  const cards = useMemo(() => {
    if (!counts) return [];
    return [
      { label: "Awaiting Pickup", value: counts.parcelsAwaitingPickup, icon: Package, color: "bg-amber-500" },
      { label: "At Warehouse", value: counts.parcelsAtWarehouse, icon: Boxes, color: "bg-sky-500" },
      { label: "In Shipment", value: counts.parcelsInShipment, icon: Truck, color: "bg-indigo-500" },
      { label: "Out for Delivery", value: counts.parcelsOutForDelivery, icon: Send, color: "bg-violet-500" },
      { label: "Delivered Today", value: counts.parcelsDelivered, icon: CheckCircle2, color: "bg-emerald-500" },
      { label: "Active Riders", value: counts.activeRiders, icon: Users, color: "bg-rose-500" },
    ];
  }, [counts]);

  const parcelChart = counts ? [
    { name: "Created", v: counts.parcelsCreated },
    { name: "Awaiting", v: counts.parcelsAwaitingPickup },
    { name: "At WH", v: counts.parcelsAtWarehouse },
    { name: "Shipping", v: counts.parcelsInShipment },
    { name: "Out", v: counts.parcelsOutForDelivery },
    { name: "Delivered", v: counts.parcelsDelivered },
  ] : [];

  const shipmentPie = counts ? [
    { name: "Created", value: counts.shipmentsCreated, fill: "#94a3b8" },
    { name: "In Transit", value: counts.shipmentsInTransit, fill: "#6366f1" },
    { name: "Arrived", value: counts.shipmentsArrived, fill: "#10b981" },
  ] : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <button onClick={refresh} className="text-xs flex items-center gap-1 px-2 py-1 bg-white border rounded hover:bg-slate-100">
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
        <span className="text-xs text-slate-500">Auto-refresh every 15s · {riders.size} riders live</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="bg-white border rounded-lg p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-500">{c.label}</div>
              <div className="text-2xl font-semibold mt-1">{c.value}</div>
            </div>
            <div className={`${c.color} text-white p-2 rounded-md`}><c.icon className="h-4 w-4" /></div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white border rounded-lg p-4 lg:col-span-2">
          <div className="text-sm font-medium mb-2">Parcels by Status</div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={parcelChart}>
                <XAxis dataKey="name" fontSize={10} />
                <YAxis fontSize={10} />
                <Tooltip />
                <Bar dataKey="v" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white border rounded-lg p-4">
          <div className="text-sm font-medium mb-2">Shipments</div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={shipmentPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-white border rounded-lg p-4">
        <div className="text-sm font-medium mb-2">Live Riders ({riders.size})</div>
        <div className="h-80 rounded overflow-hidden">
          <MapContainer center={DEFAULT_CENTER} zoom={11} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OSM" />
            {Array.from(riders.values()).map((r) => (
              <CircleMarker key={r.riderId} center={[r.lat, r.lng]} radius={8} pathOptions={{ color: "#10b981", fillOpacity: 0.7 }}>
                <Popup>
                  <div className="text-xs">
                    <div className="font-medium">{r.name ?? r.riderId.slice(0, 8)}</div>
                    <div>Speed: {r.speedKph?.toFixed?.(1) ?? "?"} km/h</div>
                    <div>Status: {r.status}</div>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Tab 2: ORDERS → PARCELS
// ═════════════════════════════════════════════════════════════════════════════

function OrdersTab() {
  const [groups, setGroups] = useState<UnassignedOrderGroup[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api<UnassignedOrderGroup[]>(`/api/v1/admin/warehouse/${WAREHOUSE_ID}/orders/unassigned`)
      .then(setGroups).catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleGroup = (city: string) => {
    setExpanded((p) => {
      const n = new Set(p);
      if (n.has(city)) n.delete(city); else n.add(city);
      return n;
    });
  };
  const toggleOrder = (id: string) => {
    setSelected((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };
  const selectAllInGroup = (g: UnassignedOrderGroup) => {
    setSelected((p) => { const n = new Set(p); g.orders.forEach((o) => n.add(o.id)); return n; });
  };

  const create = async () => {
    if (!selected.size) return toast.error("Select at least one order");
    setBusy(true);
    try {
      const data = await api<{ created: number; skipped: number; errors: string[] }>(
        `/api/v1/admin/warehouse/${WAREHOUSE_ID}/orders/bulk-create-parcels`,
        { method: "POST", body: JSON.stringify({ orderIds: Array.from(selected) }) },
      );
      toast.success(`${data.created} parcel(s) created${data.skipped ? `, ${data.skipped} skipped` : ""}`);
      data.errors?.forEach((e) => toast.error(e));
      setSelected(new Set());
      load();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  if (loading) return <Loader />;
  if (!groups.length) return <Empty msg="No unassigned orders. All caught up!" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between sticky top-0 bg-slate-50 z-10 py-2">
        <div className="text-sm text-slate-600">
          {groups.length} city group(s) · {groups.reduce((s, g) => s + g.count, 0)} order(s) · {selected.size} selected
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="text-xs px-3 py-1.5 bg-white border rounded hover:bg-slate-100">Refresh</button>
          <button onClick={create} disabled={busy || !selected.size}
            aria-label="Create parcels" title="Create parcels"
            className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-500 disabled:opacity-50">
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : `Create Parcels (${selected.size})`}
          </button>
        </div>
      </div>

      {groups.map((g) => (
        <div key={g.destCity} className="bg-white border rounded-lg">
          <button
            onClick={() => toggleGroup(g.destCity)}
            className="w-full flex items-center justify-between p-4 hover:bg-slate-50">
            <div className="flex items-center gap-3">
              {expanded.has(g.destCity) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <div className="text-left">
                <div className="font-medium">{g.destCity}</div>
                <div className="text-xs text-slate-500">{g.count} orders · {g.totalWeightKg.toFixed(1)} kg</div>
              </div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); selectAllInGroup(g); }}
              className="text-xs px-2 py-1 bg-slate-100 rounded hover:bg-slate-200">Select all</button>
          </button>
          {expanded.has(g.destCity) && (
            <div className="border-t divide-y">
              {g.orders.map((o) => (
                <label key={o.id} className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer">
                  <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggleOrder(o.id)} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-mono">{o.orderNo}</div>
                    <div className="text-xs text-slate-500 truncate">{o.destAddress}</div>
                  </div>
                  <div className="text-xs text-slate-600">{o.weightKg.toFixed(1)} kg</div>
                </label>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Tab 3: PARCELS → SHIPMENTS
// ═════════════════════════════════════════════════════════════════════════════

function ShipmentsTab() {
  const [suggestions, setSuggestions] = useState<ShipmentSuggestion[]>([]);
  const [shipments, setShipments] = useState<ShipmentResponse[]>([]);
  const [parcels, setParcels] = useState<ParcelResponse[]>([]);
  const [vehicles, setVehicles] = useState<VehicleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [parcelStatus, setParcelStatus] = useState<string>("");
  const [parcelSearch, setParcelSearch] = useState("");
  const [modal, setModal] = useState<ShipmentSuggestion | null>(null);
  const [shipModal, setShipModal] = useState<ShipmentResponse | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sug, ships, pars, vs] = await Promise.all([
        api<ShipmentSuggestion[]>(`/api/v1/admin/warehouse/${WAREHOUSE_ID}/shipments/suggestions`),
        api<ShipmentResponse[]>(`/api/v1/admin/warehouse/${WAREHOUSE_ID}/shipments`),
        api<ParcelResponse[]>(`/api/v1/admin/warehouse/${WAREHOUSE_ID}/parcels`),
        api<VehicleSummary[]>(`/api/v1/admin/warehouse/${WAREHOUSE_ID}/vehicles/available`),
      ]);
      setSuggestions(sug); setShipments(ships); setParcels(pars); setVehicles(vs);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredParcels = useMemo(() =>
    parcels.filter((p) =>
      (!parcelStatus || p.status === parcelStatus) &&
      (!parcelSearch || p.id.includes(parcelSearch) || p.orderId.includes(parcelSearch))
    ), [parcels, parcelStatus, parcelSearch]);

  const transition = async (id: string, next: string) => {
    try {
      await api(`/api/v1/admin/warehouse/shipments/${id}/status?status=${next}`, { method: "PATCH" });
      toast.success(`Shipment → ${next}`);
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  if (loading) return <Loader />;

  return (
    <div className="space-y-6">
      {/* SECTION A: Suggestions */}
      <section>
        <h2 className="text-sm font-semibold text-slate-700 mb-2">Shipment Suggestions</h2>
        {suggestions.length === 0 ? (
          <Empty msg="No groupings — all parcels already shipped." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {suggestions.map((s) => (
              <div key={s.destWarehouseId} className="bg-white border rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs text-slate-500">→ Destination</div>
                    <div className="font-semibold">{s.destCity}</div>
                  </div>
                  <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded">
                    {s.parcelCount} parcels
                  </span>
                </div>
                <div className="mt-2 text-sm text-slate-600">{s.totalWeightKg.toFixed(1)} kg total</div>
                <button onClick={() => setModal(s)}
                  className="mt-3 w-full text-xs px-3 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-500">
                  Create Shipment
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* SECTION B: Active shipments */}
      <section>
        <h2 className="text-sm font-semibold text-slate-700 mb-2">Active Shipments</h2>
        <div className="bg-white border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <Th>No.</Th><Th>Route</Th><Th>Type</Th><Th>Parcels</Th>
                <Th>Weight</Th><Th>Status</Th><Th>Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {shipments.length === 0 && (
                <tr><td colSpan={7} className="p-6 text-center text-slate-400 text-sm">No shipments</td></tr>
              )}
              {shipments.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <Td><span className="font-mono text-xs">{s.shipmentNo}</span></Td>
                  <Td>{s.originCity} → {s.destinationCity}</Td>
                  <Td><span className="text-xs">{s.shipmentType}</span></Td>
                  <Td>{s.parcelCount}</Td>
                  <Td>{s.totalWeightKg.toFixed(1)} kg</Td>
                  <Td><StatusBadge status={s.status} /></Td>
                  <Td>
                    <div className="flex gap-1 flex-wrap">
                      {s.status === "CREATED" && (
                        <button onClick={() => setShipModal(s)}
                          className="text-[10px] px-2 py-1 bg-amber-100 text-amber-800 rounded hover:bg-amber-200">
                          Assign Vehicle
                        </button>
                      )}
                      {s.status === "ASSIGNED" && (
                        <button onClick={() => transition(s.id, "PICKED_UP")}
                          className="text-[10px] px-2 py-1 bg-sky-100 text-sky-800 rounded hover:bg-sky-200">
                          Mark Picked Up
                        </button>
                      )}
                      {s.status === "PICKED_UP" && (
                        <button onClick={() => transition(s.id, "IN_TRANSIT")}
                          className="text-[10px] px-2 py-1 bg-indigo-100 text-indigo-800 rounded hover:bg-indigo-200">
                          Mark In Transit
                        </button>
                      )}
                      {s.status === "IN_TRANSIT" && (
                        <button onClick={() => transition(s.id, "ARRIVED")}
                          className="text-[10px] px-2 py-1 bg-emerald-100 text-emerald-800 rounded hover:bg-emerald-200">
                          Mark Arrived
                        </button>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* SECTION C: Parcels at warehouse */}
      <section>
        <h2 className="text-sm font-semibold text-slate-700 mb-2">Parcels at Warehouse ({parcels.length})</h2>
        <div className="flex gap-2 mb-2">
          <select value={parcelStatus} onChange={(e) => setParcelStatus(e.target.value)}
            aria-label="Filter parcels by status" title="Filter parcels by status"
            className="text-xs border rounded px-2 py-1">
            <option value="">All statuses</option>
            {["CREATED","AWAITING_PICKUP","PICKED_BY_RIDER","AT_WAREHOUSE","IN_SHIPMENT","IN_TRANSIT","AT_DEST_WAREHOUSE","OUT_FOR_DELIVERY","DELIVERED"].map((s) =>
              <option key={s} value={s}>{s}</option>)}
          </select>
          <input value={parcelSearch} onChange={(e) => setParcelSearch(e.target.value)}
            placeholder="Search by parcel/order id" className="text-xs border rounded px-2 py-1 flex-1 max-w-sm" />
        </div>
        <div className="bg-white border rounded-lg overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 sticky top-0">
              <tr><Th>Parcel</Th><Th>Order</Th><Th>Weight</Th><Th>Status</Th><Th>OTPs</Th></tr>
            </thead>
            <tbody className="divide-y">
              {filteredParcels.slice(0, 200).map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <Td><span className="font-mono text-[10px]">{p.id.slice(0, 8)}</span></Td>
                  <Td><span className="font-mono text-[10px]">{p.orderId.slice(0, 8)}</span></Td>
                  <Td>{p.weightKg.toFixed(1)} kg</Td>
                  <Td><StatusBadge status={p.status} /></Td>
                  <Td>
                    <div className="flex gap-1 text-[10px]">
                      <OtpDot ok={p.sellerPickupOtpVerified} label="S" />
                      <OtpDot ok={p.warehouseInOtpVerified} label="WI" />
                      <OtpDot ok={p.warehouseOutOtpVerified} label="WO" />
                      <OtpDot ok={p.customerDeliveryOtpVerified} label="C" />
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {modal && <CreateShipmentModal suggestion={modal} vehicles={vehicles}
        onClose={() => setModal(null)} onDone={() => { setModal(null); load(); }} />}
      {shipModal && <AssignVehicleModal shipment={shipModal} vehicles={vehicles}
        onClose={() => setShipModal(null)} onDone={() => { setShipModal(null); load(); }} />}
    </div>
  );
}

function CreateShipmentModal({ suggestion, vehicles, onClose, onDone }: {
  suggestion: ShipmentSuggestion; vehicles: VehicleSummary[]; onClose: () => void; onDone: () => void;
}) {
  const [vehicleId, setVehicleId] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await api(`/api/v1/admin/warehouse/${WAREHOUSE_ID}/shipments/bulk-create`, {
        method: "POST",
        body: JSON.stringify({
          destWarehouseId: suggestion.destWarehouseId,
          parcelIds: suggestion.parcelIds,
          vehicleId: vehicleId || undefined,
          shipmentType: "INTER_HUB",
        }),
      });
      toast.success(`Shipment created → ${suggestion.destCity}`);
      onDone();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Modal onClose={onClose} title={`Create Shipment → ${suggestion.destCity}`}>
      <div className="text-sm text-slate-600">
        {suggestion.parcelCount} parcels · {suggestion.totalWeightKg.toFixed(1)} kg
      </div>
      <label className="text-xs text-slate-700 mt-3 block" htmlFor="create-shipment-vehicle">Vehicle (optional)</label>
      <select id="create-shipment-vehicle" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}
        aria-label="Vehicle" title="Vehicle"
        className="w-full border rounded px-2 py-1.5 text-sm mt-1">
        <option value="">— none, assign later —</option>
        {vehicles.map((v) =>
          <option key={v.id} value={v.id}>{v.vehicleNumber} · {v.vehicleType} · {v.capacityKg}kg</option>)}
      </select>
      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onClose} className="text-xs px-3 py-1.5 border rounded">Cancel</button>
        <button onClick={submit} disabled={busy}
          className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded disabled:opacity-50">
          {busy ? "Creating…" : "Confirm"}
        </button>
      </div>
    </Modal>
  );
}

function AssignVehicleModal({ shipment, vehicles, onClose, onDone }: {
  shipment: ShipmentResponse; vehicles: VehicleSummary[]; onClose: () => void; onDone: () => void;
}) {
  const [vehicleId, setVehicleId] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!vehicleId) return toast.error("Pick a vehicle");
    setBusy(true);
    try {
      await api(`/api/v1/admin/warehouse/shipments/${shipment.id}/assign-vehicle`, {
        method: "POST", body: JSON.stringify({ vehicleId }),
      });
      toast.success("Vehicle assigned + route created");
      onDone();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Modal onClose={onClose} title={`Assign Vehicle to ${shipment.shipmentNo}`}>
      <div className="text-sm text-slate-600">{shipment.originCity} → {shipment.destinationCity}</div>
      <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}
        aria-label="Select vehicle" title="Select vehicle"
        className="w-full border rounded px-2 py-1.5 text-sm mt-3">
        <option value="">— pick a vehicle —</option>
        {vehicles.map((v) =>
          <option key={v.id} value={v.id}>{v.vehicleNumber} · {v.vehicleType} · {v.capacityKg}kg / {v.maxParcels}p</option>)}
      </select>
      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onClose} className="text-xs px-3 py-1.5 border rounded">Cancel</button>
        <button onClick={submit} disabled={busy}
          className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded disabled:opacity-50">
          {busy ? "Assigning…" : "Assign"}
        </button>
      </div>
    </Modal>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Tab 4: RIDERS & ROUTES
// ═════════════════════════════════════════════════════════════════════════════

function RidersTab({ riders }: { riders: Map<string, RiderLive> }) {
  const [bundles, setBundles] = useState<RiderBundle[]>([]);
  const [parcels, setParcels] = useState<ParcelResponse[]>([]);
  const [riderPool, setRiderPool] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignFor, setAssignFor] = useState<ParcelResponse | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [b, p] = await Promise.all([
        api<RiderBundle[]>(`/api/v1/admin/warehouse/${WAREHOUSE_ID}/route-assignments`),
        api<ParcelResponse[]>(`/api/v1/admin/warehouse/${WAREHOUSE_ID}/parcels?status=AT_DEST_WAREHOUSE`),
      ]);
      setBundles(b);
      setParcels(p);
      setRiderPool(b.map((x) => ({ id: x.riderId, name: x.riderName })));
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Loader />;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Left: rider routes */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Riders today ({bundles.length})</h2>
        {bundles.length === 0 && <Empty msg="No active assignments" />}
        {bundles.map((b) => {
          const live = riders.get(b.riderId);
          return (
            <div key={b.riderId} className="bg-white border rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm">{b.riderName}</div>
                  <div className="text-[10px] text-slate-500">{b.riderPhone ?? "—"}</div>
                </div>
                <div className="text-xs text-slate-600">
                  {b.completed}/{b.totalStops} stops
                  {live && <span className="ml-2 text-emerald-600">● live</span>}
                </div>
              </div>
              <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                {b.assignments.map((s) => (
                  <div key={s.assignmentId}
                    className="flex items-center gap-2 text-xs bg-slate-50 rounded px-2 py-1">
                    <span className="w-5 text-slate-500 font-mono">{s.sequenceNumber}</span>
                    <span className="flex-1 truncate">{s.destAddress}</span>
                    <StatusBadge status={s.status} />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Right: AT_DEST_WAREHOUSE parcels needing delivery rider */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Awaiting Delivery Rider ({parcels.length})</h2>
        {parcels.length === 0 && <Empty msg="No parcels at destination warehouse." />}
        {parcels.map((p) => (
          <div key={p.id} className="bg-white border rounded-lg p-3 flex items-center justify-between">
            <div>
              <div className="font-mono text-xs">{p.id.slice(0, 8)}…</div>
              <div className="text-[10px] text-slate-500">order {p.orderId.slice(0, 8)}… · {p.weightKg.toFixed(1)} kg</div>
            </div>
            <button onClick={() => setAssignFor(p)}
              className="text-xs px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-500">
              Assign Rider
            </button>
          </div>
        ))}
      </div>

      {assignFor && <AssignDeliveryRiderModal parcel={assignFor} riders={riderPool}
        onClose={() => setAssignFor(null)} onDone={() => { setAssignFor(null); load(); }} />}
    </div>
  );
}

function AssignDeliveryRiderModal({ parcel, riders, onClose, onDone }: {
  parcel: ParcelResponse; riders: { id: string; name: string }[]; onClose: () => void; onDone: () => void;
}) {
  const [riderId, setRiderId] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!riderId) return toast.error("Pick a rider");
    setBusy(true);
    try {
      await api(`/api/v1/admin/warehouse/parcels/assign-delivery-rider`, {
        method: "POST", body: JSON.stringify({ parcelId: parcel.id, riderId }),
      });
      toast.success("Delivery rider assigned, OTPs dispatched");
      onDone();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Modal onClose={onClose} title={`Assign delivery rider`}>
      <div className="text-xs font-mono text-slate-500">{parcel.id}</div>
      <select value={riderId} onChange={(e) => setRiderId(e.target.value)}
        aria-label="Select rider" title="Select rider"
        className="w-full border rounded px-2 py-1.5 text-sm mt-3">
        <option value="">— pick a rider —</option>
        {riders.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
      </select>
      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onClose} className="text-xs px-3 py-1.5 border rounded">Cancel</button>
        <button onClick={submit} disabled={busy}
          className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded disabled:opacity-50">
          {busy ? "Assigning…" : "Assign"}
        </button>
      </div>
    </Modal>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Tab 5: LIVE MAP
// ═════════════════════════════════════════════════════════════════════════════

function LiveMapTab({ riders }: { riders: Map<string, RiderLive> }) {
  return (
    <div className="bg-white border rounded-lg overflow-hidden h-[calc(100vh-200px)]">
      <MapContainer center={DEFAULT_CENTER} zoom={11} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OSM" />
        {/* Warehouse */}
        <Marker position={DEFAULT_CENTER} icon={warehouseIcon()}>
          <Popup>Warehouse</Popup>
        </Marker>
        {Array.from(riders.values()).map((r) => {
          const color = r.status === "active" ? "#10b981"
            : r.status === "idle" ? "#f59e0b" : "#ef4444";
          return (
            <CircleMarker key={r.riderId} center={[r.lat, r.lng]} radius={9}
              pathOptions={{ color, fillOpacity: 0.85 }}>
              <Popup>
                <div className="text-xs">
                  <div className="font-medium">{r.name ?? r.riderId.slice(0, 8)}</div>
                  <div>Speed: {r.speedKph?.toFixed?.(1) ?? "?"} km/h</div>
                  <div>Heading: {r.heading?.toFixed?.(0) ?? "?"}°</div>
                  <div>Status: {r.status}</div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}

function warehouseIcon() {
  return L.divIcon({
    html: `<div style="background:#0f172a;color:#fbbf24;padding:4px 6px;border-radius:4px;font-size:14px;line-height:1">★</div>`,
    className: "", iconSize: [20, 20], iconAnchor: [10, 10],
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// Tiny presentational helpers
// ═════════════════════════════════════════════════════════════════════════════

function Th({ children }: { children: ReactNode }) {
  return <th className="text-left font-medium px-3 py-2 text-xs uppercase tracking-wide">{children}</th>;
}
function Td({ children }: { children: ReactNode }) {
  return <td className="px-3 py-2">{children}</td>;
}
function StatusBadge({ status }: { status: string }) {
  const cls = ({
    CREATED: "bg-slate-100 text-slate-700",
    AWAITING_PICKUP: "bg-amber-100 text-amber-700",
    PICKED_BY_RIDER: "bg-sky-100 text-sky-700",
    AT_WAREHOUSE: "bg-blue-100 text-blue-700",
    IN_SHIPMENT: "bg-indigo-100 text-indigo-700",
    IN_TRANSIT: "bg-violet-100 text-violet-700",
    AT_DEST_WAREHOUSE: "bg-cyan-100 text-cyan-700",
    OUT_FOR_DELIVERY: "bg-fuchsia-100 text-fuchsia-700",
    DELIVERED: "bg-emerald-100 text-emerald-700",
    ASSIGNED: "bg-amber-100 text-amber-700",
    PICKED_UP: "bg-sky-100 text-sky-700",
    ARRIVED: "bg-emerald-100 text-emerald-700",
    PICKED: "bg-sky-100 text-sky-700",
    FAILED: "bg-rose-100 text-rose-700",
  } as Record<string, string>)[status] ?? "bg-slate-100 text-slate-700";
  return <span className={`text-[10px] px-2 py-0.5 rounded ${cls}`}>{status}</span>;
}
function OtpDot({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span title={`${label} OTP ${ok ? "verified" : "pending"}`}
      className={`inline-flex items-center justify-center w-5 h-5 rounded text-[9px] font-semibold
        ${ok ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>
      {label}
    </span>
  );
}
function Loader() {
  return <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
}
function Empty({ msg }: { msg: string }) {
  return (
    <div className="bg-white border rounded-lg p-8 text-center text-sm text-slate-500 flex flex-col items-center gap-2">
      <AlertCircle className="h-5 w-5" /> {msg}
    </div>
  );
}
function Modal({ children, title, onClose }: { children: ReactNode; title: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-semibold text-sm">{title}</h3>
          <button onClick={onClose} aria-label="Close" title="Close"
            className="text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
