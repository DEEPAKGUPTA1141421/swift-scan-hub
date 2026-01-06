export interface Warehouse {
  id: string;
  name: string;
  city: string;
}

export interface Order {
  id: string;
  qrCode: string;
  currentCity: string;
  nextDestination: string;
  routeSequence: number;
  status: 'PENDING' | 'RECEIVED' | 'IN_PARCEL' | 'DISPATCHED';
  receivedAt?: Date;
  parcelId?: string;
}

export interface Parcel {
  id: string;
  qrCode: string;
  destinationCity: string;
  currentWarehouse: string;
  orders: string[];
  status: 'OPEN' | 'READY_TO_DISPATCH' | 'DISPATCHED' | 'RECEIVED';
  createdAt: Date;
  dispatchedAt?: Date;
  riderId?: string;
  vehicleNumber?: string;
}

export interface User {
  id: string;
  email: string;
  role: 'OPERATOR' | 'MANAGER';
  warehouseId?: string;
}

export interface DashboardStats {
  ordersReceivedToday: number;
  ordersWaitingForBagging: number;
  parcelsReadyToDispatch: number;
}
