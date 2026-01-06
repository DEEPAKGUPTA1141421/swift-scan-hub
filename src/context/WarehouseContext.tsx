import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Warehouse, Order, Parcel, User, DashboardStats } from '@/types/warehouse';

// Mock data
const MOCK_WAREHOUSES: Warehouse[] = [
  { id: 'wh-1', name: 'Mumbai Central Hub', city: 'Mumbai' },
  { id: 'wh-2', name: 'Delhi North Warehouse', city: 'Delhi' },
  { id: 'wh-3', name: 'Bangalore Tech Hub', city: 'Bangalore' },
  { id: 'wh-4', name: 'Chennai Port Facility', city: 'Chennai' },
];

const generateOrderId = () => `ORD-${Date.now().toString(36).toUpperCase()}`;
const generateParcelId = () => `PCL-${Date.now().toString(36).toUpperCase()}`;

interface WarehouseContextType {
  user: User | null;
  currentWarehouse: Warehouse | null;
  warehouses: Warehouse[];
  orders: Order[];
  parcels: Parcel[];
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  selectWarehouse: (warehouseId: string) => void;
  receiveOrder: (qrCode: string) => { success: boolean; order?: Order; error?: string };
  createParcel: (destinationCity: string) => Parcel;
  addOrderToParcel: (orderId: string, parcelId: string) => { success: boolean; error?: string };
  closeParcel: (parcelId: string) => { success: boolean; error?: string };
  dispatchParcel: (parcelId: string, riderId: string, vehicleNumber: string) => { success: boolean; error?: string };
  receiveParcel: (qrCode: string) => { success: boolean; parcel?: Parcel; error?: string };
  openParcel: (parcelId: string) => { success: boolean; error?: string };
  getParcelByQr: (qrCode: string) => Parcel | undefined;
  getOrderByQr: (qrCode: string) => Order | undefined;
  getDashboardStats: () => DashboardStats;
}

const WarehouseContext = createContext<WarehouseContextType | undefined>(undefined);

// Initialize with some mock orders
const INITIAL_ORDERS: Order[] = [
  { id: 'ORD-ABC123', qrCode: 'ORD-ABC123', currentCity: 'Mumbai', nextDestination: 'Delhi', routeSequence: 1, status: 'PENDING' },
  { id: 'ORD-DEF456', qrCode: 'ORD-DEF456', currentCity: 'Mumbai', nextDestination: 'Delhi', routeSequence: 2, status: 'PENDING' },
  { id: 'ORD-GHI789', qrCode: 'ORD-GHI789', currentCity: 'Mumbai', nextDestination: 'Bangalore', routeSequence: 1, status: 'PENDING' },
  { id: 'ORD-JKL012', qrCode: 'ORD-JKL012', currentCity: 'Delhi', nextDestination: 'Chennai', routeSequence: 1, status: 'PENDING' },
  { id: 'ORD-MNO345', qrCode: 'ORD-MNO345', currentCity: 'Mumbai', nextDestination: 'Delhi', routeSequence: 3, status: 'RECEIVED', receivedAt: new Date() },
];

export function WarehouseProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [currentWarehouse, setCurrentWarehouse] = useState<Warehouse | null>(null);
  const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS);
  const [parcels, setParcels] = useState<Parcel[]>([]);

  const login = async (email: string, password: string): Promise<boolean> => {
    // Mock login - accept any email/password for demo
    if (email && password) {
      setUser({
        id: 'user-1',
        email,
        role: email.includes('manager') ? 'MANAGER' : 'OPERATOR',
      });
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    setCurrentWarehouse(null);
  };

  const selectWarehouse = (warehouseId: string) => {
    const warehouse = MOCK_WAREHOUSES.find(w => w.id === warehouseId);
    if (warehouse) {
      setCurrentWarehouse(warehouse);
    }
  };

  const receiveOrder = (qrCode: string): { success: boolean; order?: Order; error?: string } => {
    const order = orders.find(o => o.qrCode === qrCode);
    
    if (!order) {
      return { success: false, error: 'Invalid QR code - Order not found' };
    }
    
    if (order.status === 'RECEIVED' || order.status === 'IN_PARCEL') {
      return { success: false, error: 'Order already received at warehouse' };
    }
    
    if (order.currentCity !== currentWarehouse?.city) {
      return { success: false, error: `Order belongs to ${order.currentCity}, not ${currentWarehouse?.city}` };
    }

    const updatedOrder = { ...order, status: 'RECEIVED' as const, receivedAt: new Date() };
    setOrders(prev => prev.map(o => o.id === order.id ? updatedOrder : o));
    
    return { success: true, order: updatedOrder };
  };

  const createParcel = (destinationCity: string): Parcel => {
    const parcel: Parcel = {
      id: generateParcelId(),
      qrCode: generateParcelId(),
      destinationCity,
      currentWarehouse: currentWarehouse?.city || '',
      orders: [],
      status: 'OPEN',
      createdAt: new Date(),
    };
    setParcels(prev => [...prev, parcel]);
    return parcel;
  };

  const addOrderToParcel = (orderId: string, parcelId: string): { success: boolean; error?: string } => {
    const order = orders.find(o => o.id === orderId);
    const parcel = parcels.find(p => p.id === parcelId);

    if (!order) return { success: false, error: 'Order not found' };
    if (!parcel) return { success: false, error: 'Parcel not found' };
    if (parcel.status !== 'OPEN') return { success: false, error: 'Parcel is already closed' };
    if (order.status === 'IN_PARCEL') return { success: false, error: 'Order already in a parcel' };
    if (order.nextDestination !== parcel.destinationCity) {
      return { success: false, error: `Order destination (${order.nextDestination}) doesn't match parcel destination (${parcel.destinationCity})` };
    }
    if (parcel.orders.includes(orderId)) {
      return { success: false, error: 'Order already added to this parcel' };
    }

    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'IN_PARCEL' as const, parcelId } : o));
    setParcels(prev => prev.map(p => p.id === parcelId ? { ...p, orders: [...p.orders, orderId] } : p));

    return { success: true };
  };

  const closeParcel = (parcelId: string): { success: boolean; error?: string } => {
    const parcel = parcels.find(p => p.id === parcelId);
    
    if (!parcel) return { success: false, error: 'Parcel not found' };
    if (parcel.orders.length === 0) return { success: false, error: 'Cannot close empty parcel' };

    setParcels(prev => prev.map(p => p.id === parcelId ? { ...p, status: 'READY_TO_DISPATCH' as const } : p));
    return { success: true };
  };

  const dispatchParcel = (parcelId: string, riderId: string, vehicleNumber: string): { success: boolean; error?: string } => {
    const parcel = parcels.find(p => p.id === parcelId);
    
    if (!parcel) return { success: false, error: 'Parcel not found' };
    if (parcel.status !== 'READY_TO_DISPATCH') return { success: false, error: 'Parcel is not ready for dispatch' };

    setParcels(prev => prev.map(p => p.id === parcelId ? { 
      ...p, 
      status: 'DISPATCHED' as const, 
      dispatchedAt: new Date(),
      riderId,
      vehicleNumber 
    } : p));

    // Update orders status
    setOrders(prev => prev.map(o => 
      parcel.orders.includes(o.id) ? { ...o, status: 'DISPATCHED' as const } : o
    ));

    return { success: true };
  };

  const receiveParcel = (qrCode: string): { success: boolean; parcel?: Parcel; error?: string } => {
    const parcel = parcels.find(p => p.qrCode === qrCode);
    
    if (!parcel) return { success: false, error: 'Invalid QR - Parcel not found' };
    if (parcel.status !== 'DISPATCHED') return { success: false, error: 'Parcel has not been dispatched' };

    const updatedParcel = { ...parcel, status: 'RECEIVED' as const, currentWarehouse: currentWarehouse?.city || '' };
    setParcels(prev => prev.map(p => p.id === parcel.id ? updatedParcel : p));

    return { success: true, parcel: updatedParcel };
  };

  const openParcel = (parcelId: string): { success: boolean; error?: string } => {
    const parcel = parcels.find(p => p.id === parcelId);
    
    if (!parcel) return { success: false, error: 'Parcel not found' };
    if (parcel.status !== 'RECEIVED') return { success: false, error: 'Can only open received parcels' };

    // Update orders to be available for next routing
    setOrders(prev => prev.map(o => 
      parcel.orders.includes(o.id) ? { 
        ...o, 
        status: 'RECEIVED' as const, 
        currentCity: currentWarehouse?.city || o.currentCity,
        parcelId: undefined 
      } : o
    ));

    // Remove parcel after opening
    setParcels(prev => prev.filter(p => p.id !== parcelId));

    return { success: true };
  };

  const getParcelByQr = (qrCode: string) => parcels.find(p => p.qrCode === qrCode);
  const getOrderByQr = (qrCode: string) => orders.find(o => o.qrCode === qrCode);

  const getDashboardStats = (): DashboardStats => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return {
      ordersReceivedToday: orders.filter(o => 
        o.receivedAt && new Date(o.receivedAt) >= today && o.currentCity === currentWarehouse?.city
      ).length,
      ordersWaitingForBagging: orders.filter(o => 
        o.status === 'RECEIVED' && o.currentCity === currentWarehouse?.city
      ).length,
      parcelsReadyToDispatch: parcels.filter(p => 
        p.status === 'READY_TO_DISPATCH' && p.currentWarehouse === currentWarehouse?.city
      ).length,
    };
  };

  return (
    <WarehouseContext.Provider value={{
      user,
      currentWarehouse,
      warehouses: MOCK_WAREHOUSES,
      orders,
      parcels,
      login,
      logout,
      selectWarehouse,
      receiveOrder,
      createParcel,
      addOrderToParcel,
      closeParcel,
      dispatchParcel,
      receiveParcel,
      openParcel,
      getParcelByQr,
      getOrderByQr,
      getDashboardStats,
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
