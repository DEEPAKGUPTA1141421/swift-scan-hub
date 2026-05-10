import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { Warehouse, Order, Parcel, User, DashboardStats } from '@/types/warehouse';
import {
  warehouseApi,
  parcelApi,
  shipmentApi,
  BackendWarehouse,
  mapBackendParcelToOrder,
  mapBackendShipmentToParcel,
} from '@/services/api';

interface ReceiveOrderResult {
  success: boolean;
  order?: Order;
  needsOtp?: boolean;
  error?: string;
}

interface WarehouseContextType {
  // State
  user: User | null;
  currentWarehouse: Warehouse | null;
  warehouses: Warehouse[];
  orders: Order[];
  parcels: Parcel[];
  isLoadingWarehouses: boolean;
  isLoadingData: boolean;

  // Auth
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;

  // Warehouse
  selectWarehouse: (warehouseId: string) => void;
  refreshData: () => Promise<void>;

  // Order operations (backend: parcel)
  receiveOrder: (qrCode: string) => Promise<ReceiveOrderResult>;
  confirmWarehouseIn: (parcelId: string, otp: string) => Promise<{ success: boolean; error?: string }>;
  getOrderByQr: (qrCode: string) => Order | undefined;
  addOrderToParcel: (orderId: string, parcelId: string) => Promise<{ success: boolean; error?: string }>;

  // Parcel operations (backend: shipment)
  createParcel: (destinationCity: string) => Promise<Parcel>;
  closeParcel: (parcelId: string) => Promise<{ success: boolean; error?: string }>;
  dispatchParcel: (parcelId: string, riderId: string, vehicleNumber: string) => Promise<{ success: boolean; error?: string }>;
  receiveParcel: (qrCode: string) => Promise<{ success: boolean; parcel?: Parcel; error?: string }>;
  openParcel: (parcelId: string) => Promise<{ success: boolean; error?: string }>;
  getParcelByQr: (qrCode: string) => Parcel | undefined;

  // Dashboard
  getDashboardStats: () => DashboardStats;
  dashboardStats: DashboardStats | null;
}

const WarehouseContext = createContext<WarehouseContextType | undefined>(undefined);

export function WarehouseProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [currentWarehouseId, setCurrentWarehouseId] = useState<string | null>(null);
  const [backendWarehouses, setBackendWarehouses] = useState<BackendWarehouse[]>([]);
  const [isLoadingWarehouses, setIsLoadingWarehouses] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);

  // Derive current warehouse and mapped list
  const currentWarehouse = backendWarehouses.find(w => w.id === currentWarehouseId) ?? null;
  const warehouses: Warehouse[] = useMemo(() => backendWarehouses.map(w => ({
    id: w.id,
    name: w.name,
    city: w.city,
    state: w.state,
    address: w.address,
    lat: w.lat,
    lng: w.lng,
    type: w.type,
    status: w.status,
  })), [backendWarehouses]);

  // Build warehouse map for quick lookup
  const warehouseMap = useMemo(
    () => Object.fromEntries(backendWarehouses.map(w => [w.id, w])),
    [backendWarehouses]
  );

  // Load warehouses on mount
  useEffect(() => {
    warehouseApi.list()
      .then(data => setBackendWarehouses(data))
      .catch(err => {
        console.error('Failed to load warehouses', err);
        setBackendWarehouses([]);
      })
      .finally(() => setIsLoadingWarehouses(false));
  }, []);

  const createDashboardStats = (override: Partial<DashboardStats> = {}): DashboardStats => ({
    warehouseId: currentWarehouse?.id,
    warehouseName: currentWarehouse?.name,
    city: currentWarehouse?.city,
    ordersReceivedToday: 0,
    ordersWaitingForBagging: 0,
    parcelsReadyToDispatch: 0,
    parcelsCreated: 0,
    parcelsAwaitingPickup: 0,
    parcelsAtWarehouse: 0,
    parcelsInShipment: 0,
    parcelsOutForDelivery: 0,
    parcelsDelivered: 0,
    shipmentsCreated: 0,
    parcelsInTransit: 0,
    shipmentsInTransit: 0,
    shipmentsArrived: 0,
    activeRiders: undefined,
    ...override,
  });

  const loadWarehouseData = useCallback(async (warehouseId: string) => {
    setIsLoadingData(true);
    try {
      const [parcelsRes, shipmentsRes, dashboardRes] = await Promise.allSettled([
        parcelApi.getByWarehouse(warehouseId, 'AT_WAREHOUSE'),
        shipmentApi.getByWarehouse(warehouseId),
        warehouseApi.getDashboard(warehouseId),
      ]);

      if (parcelsRes.status === 'fulfilled') {
        setOrders(parcelsRes.value.data.map(p => mapBackendParcelToOrder(p, warehouseMap)));
      } else {
        console.error('Failed to load parcels:', parcelsRes.reason);
      }

      if (shipmentsRes.status === 'fulfilled') {
        setParcels(shipmentsRes.value.data.map(s => mapBackendShipmentToParcel(s)));
      } else {
        console.error('Failed to load shipments:', shipmentsRes.reason);
        setParcels([]); // Set empty array as fallback
      }

      if (dashboardRes.status === 'fulfilled') {
        const d = dashboardRes.value;
        setDashboardStats(createDashboardStats({
          warehouseId: d.warehouseId,
          warehouseName: d.warehouseName,
          city: d.city,
          ordersReceivedToday: d.parcelsAtWarehouse,
          ordersWaitingForBagging: d.parcelsInShipment,
          parcelsReadyToDispatch: d.shipmentsCreated,
          parcelsCreated: d.parcelsCreated,
          parcelsAwaitingPickup: d.parcelsAwaitingPickup,
          parcelsAtWarehouse: d.parcelsAtWarehouse,
          parcelsInShipment: d.parcelsInShipment,
          parcelsOutForDelivery: d.parcelsOutForDelivery,
          parcelsDelivered: d.parcelsDelivered,
          shipmentsCreated: d.shipmentsCreated,
          shipmentsInTransit: d.shipmentsInTransit,
          shipmentsArrived: d.shipmentsArrived,
          parcelsInTransit: d.shipmentsInTransit,
          activeRiders: d.activeRiders,
        }));
      } else {
        console.error('Dashboard API failed:', dashboardRes.reason);
      }
    } catch (err) {
      console.error('Failed to load warehouse data', err);
    } finally {
      setIsLoadingData(false);
    }
  }, [warehouseMap, currentWarehouse]);

  useEffect(() => {
    if (currentWarehouseId) {
      loadWarehouseData(currentWarehouseId);
    }
  }, [currentWarehouseId, loadWarehouseData]);

  const refreshData = useCallback(async () => {
    if (currentWarehouseId) await loadWarehouseData(currentWarehouseId);
  }, [currentWarehouseId, loadWarehouseData]);

  // ── Auth ──────────────────────────────────────────────────────────────────

  const login = async (email: string, password: string): Promise<boolean> => {
    if (!email || !password) return false;
    setUser({
      id: 'user-1',
      email,
      role: email.includes('manager') ? 'MANAGER' : 'OPERATOR',
    });
    return true;
  };

  const logout = () => {
    setUser(null);
    setCurrentWarehouseId(null);
    setOrders([]);
    setParcels([]);
    setDashboardStats(null);
  };

  // ── Warehouse ─────────────────────────────────────────────────────────────

  const selectWarehouse = (warehouseId: string) => {
    setCurrentWarehouseId(warehouseId);
  };

  // ── Order operations ──────────────────────────────────────────────────────

  const receiveOrder = async (qrCode: string): Promise<ReceiveOrderResult> => {
    try {
      const res = await parcelApi.getById(qrCode);
      const parcel = res.data;

      if (!parcel) return { success: false, error: 'Order not found' };

      const order = mapBackendParcelToOrder(parcel, warehouseMap);

      // Already at this warehouse
      if (parcel.status === 'AT_WAREHOUSE') {
        if (currentWarehouse && parcel.currentWarehouseId !== currentWarehouseId) {
          return { success: false, error: `Order is at a different warehouse` };
        }
        setOrders(prev => {
          const exists = prev.find(o => o.id === order.id);
          return exists ? prev.map(o => o.id === order.id ? order : o) : [...prev, order];
        });
        return { success: true, order };
      }

      // Parcel is with a rider coming to this warehouse — initiate warehouse-in
      if (parcel.status === 'PICKED_BY_RIDER') {
        await parcelApi.initiateWarehouseIn(qrCode);
        return { success: true, order, needsOtp: true };
      }

      return { success: false, error: `Order status is ${parcel.status} — cannot receive now` };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to receive order';
      return { success: false, error: msg };
    }
  };

  const confirmWarehouseIn = async (
    parcelId: string,
    otp: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await parcelApi.verifyWarehouseIn(parcelId, otp, user?.id ?? 'operator');
      if (!res.data.verified) return { success: false, error: 'Invalid OTP' };

      // Refresh the order in local state
      const updated = await parcelApi.getById(parcelId);
      const order = mapBackendParcelToOrder(updated.data, warehouseMap);
      setOrders(prev => {
        const exists = prev.find(o => o.id === order.id);
        return exists ? prev.map(o => o.id === order.id ? order : o) : [...prev, order];
      });
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'OTP verification failed';
      return { success: false, error: msg };
    }
  };

  const getOrderByQr = (qrCode: string) => orders.find(o => o.qrCode === qrCode);

  const addOrderToParcel = async (
    orderId: string,
    parcelId: string
  ): Promise<{ success: boolean; error?: string }> => {
    const order = orders.find(o => o.id === orderId);
    const parcel = parcels.find(p => p.id === parcelId);

    if (!order) return { success: false, error: 'Order not found' };
    if (!parcel) return { success: false, error: 'Parcel not found' };
    if (parcel.status !== 'OPEN') return { success: false, error: 'Parcel is already closed' };

    try {
      await shipmentApi.addParcels(parcelId, [orderId]);
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'IN_PARCEL' as const, parcelId } : o));
      setParcels(prev => prev.map(p => p.id === parcelId ? { ...p, orders: [...p.orders, orderId] } : p));
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add order to parcel';
      return { success: false, error: msg };
    }
  };

  // ── Parcel operations (= backend shipments) ───────────────────────────────

  const createParcel = async (destinationCity: string): Promise<Parcel> => {
    if (!currentWarehouse) throw new Error('No warehouse selected');

    const destWarehouse = backendWarehouses.find(
      w => w.city.toLowerCase() === destinationCity.toLowerCase()
    );
    if (!destWarehouse) throw new Error(`No warehouse found for city: ${destinationCity}`);

    const now = new Date().toISOString();
    const eta = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const res = await shipmentApi.create({
      shipmentType: 'LAST_MILE',
      originWarehouseId: currentWarehouseId!,
      destinationWarehouseId: destWarehouse.id,
      departureTimeEst: now,
      arrivalTimeEst: eta,
    });

    const newParcel = mapBackendShipmentToParcel(res.data);
    setParcels(prev => [...prev, newParcel]);
    return newParcel;
  };

  const closeParcel = async (parcelId: string): Promise<{ success: boolean; error?: string }> => {
    const parcel = parcels.find(p => p.id === parcelId);
    if (!parcel) return { success: false, error: 'Parcel not found' };
    if (parcel.orders.length === 0) return { success: false, error: 'Cannot close empty parcel' };

    try {
      await shipmentApi.updateStatus(parcelId, 'ASSIGNED');
      setParcels(prev => prev.map(p => p.id === parcelId ? { ...p, status: 'READY_TO_DISPATCH' as const } : p));
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to close parcel';
      return { success: false, error: msg };
    }
  };

  const dispatchParcel = async (
    parcelId: string,
    riderId: string,
    _vehicleNumber: string
  ): Promise<{ success: boolean; error?: string }> => {
    const parcel = parcels.find(p => p.id === parcelId);
    if (!parcel) return { success: false, error: 'Parcel not found' };
    if (parcel.status !== 'READY_TO_DISPATCH') return { success: false, error: 'Parcel not ready for dispatch' };

    try {
      // Assign delivery rider to each parcel in the shipment
      if (riderId) {
        await Promise.allSettled(
          parcel.orders.map(orderId => parcelApi.assignDeliveryRider(orderId, riderId))
        );
      }

      await shipmentApi.updateStatus(parcelId, 'IN_TRANSIT');

      setParcels(prev => prev.map(p =>
        p.id === parcelId
          ? { ...p, status: 'DISPATCHED' as const, dispatchedAt: new Date(), riderId }
          : p
      ));
      setOrders(prev => prev.map(o =>
        parcel.orders.includes(o.id) ? { ...o, status: 'DISPATCHED' as const } : o
      ));
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to dispatch parcel';
      return { success: false, error: msg };
    }
  };

  const receiveParcel = async (
    qrCode: string
  ): Promise<{ success: boolean; parcel?: Parcel; error?: string }> => {
    try {
      const res = await shipmentApi.getById(qrCode);
      const shipment = res.data;

      if (!shipment) return { success: false, error: 'Parcel not found' };
      if (shipment.status !== 'IN_TRANSIT') {
        return { success: false, error: `Parcel status is ${shipment.status} — not in transit` };
      }

      await shipmentApi.updateStatus(qrCode, 'ARRIVED');

      const parcel = mapBackendShipmentToParcel({ ...shipment, status: 'ARRIVED' });
      parcel.currentWarehouse = currentWarehouse?.city ?? parcel.currentWarehouse;
      setParcels(prev => {
        const exists = prev.find(p => p.id === parcel.id);
        return exists
          ? prev.map(p => p.id === parcel.id ? parcel : p)
          : [...prev, parcel];
      });
      return { success: true, parcel };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to receive parcel';
      return { success: false, error: msg };
    }
  };

  const openParcel = async (parcelId: string): Promise<{ success: boolean; error?: string }> => {
    const parcel = parcels.find(p => p.id === parcelId);
    if (!parcel) return { success: false, error: 'Parcel not found' };
    if (parcel.status !== 'RECEIVED') return { success: false, error: 'Can only open received parcels' };

    // Orders inside become available again at this warehouse
    setOrders(prev => prev.map(o =>
      parcel.orders.includes(o.id)
        ? { ...o, status: 'RECEIVED' as const, currentCity: currentWarehouse?.city ?? o.currentCity, parcelId: undefined }
        : o
    ));
    setParcels(prev => prev.filter(p => p.id !== parcelId));
    return { success: true };
  };

  const getParcelByQr = (qrCode: string) => parcels.find(p => p.qrCode === qrCode);

  // ── Dashboard ─────────────────────────────────────────────────────────────

  const getDashboardStats = (): DashboardStats => {
    if (dashboardStats) return dashboardStats;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return createDashboardStats({
      warehouseId: currentWarehouse?.id,
      warehouseName: currentWarehouse?.name,
      city: currentWarehouse?.city,
      ordersReceivedToday: orders.filter(o =>
        o.receivedAt && new Date(o.receivedAt) >= today
      ).length,
      ordersWaitingForBagging: orders.filter(o =>
        o.status === 'RECEIVED' && o.currentCity === currentWarehouse?.city
      ).length,
      parcelsReadyToDispatch: parcels.filter(p =>
        p.status === 'READY_TO_DISPATCH' && p.currentWarehouse === currentWarehouse?.city
      ).length,
    });
  };

  return (
    <WarehouseContext.Provider value={{
      user,
      currentWarehouse,
      warehouses,
      orders,
      parcels,
      isLoadingWarehouses,
      isLoadingData,
      login,
      logout,
      selectWarehouse,
      refreshData,
      receiveOrder,
      confirmWarehouseIn,
      getOrderByQr,
      addOrderToParcel,
      createParcel,
      closeParcel,
      dispatchParcel,
      receiveParcel,
      openParcel,
      getParcelByQr,
      getDashboardStats,
      dashboardStats,
    }}>
      {children}
    </WarehouseContext.Provider>
  );
}

export function useWarehouse() {
  const context = useContext(WarehouseContext);
  if (context === undefined) {
    throw new Error('useWarehouse must be used within a WarehouseProvider');
  }
  return context;
}
