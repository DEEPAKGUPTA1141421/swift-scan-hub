export interface Warehouse {
  id: string;
  name: string;
  city: string;
  state?: string;
  address?: string;
  lat?: number;
  lng?: number;
  type?: 'STAGING' | 'REGIONAL' | 'LAST_MILE_DEPOT';
  status?: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
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
  shipmentNo?: string;
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
  phone: string;
  name?: string;
  role: 'HUB_OWNER';
  warehouseId?: string;
}

export interface DashboardStats {
  ordersReceivedToday: number;
  ordersWaitingForBagging: number;
  parcelsReadyToDispatch: number;
  warehouseId?: string;
  warehouseName?: string;
  city?: string;
  parcelsCreated?: number;
  parcelsAwaitingPickup?: number;
  parcelsAtWarehouse?: number;
  parcelsInShipment?: number;
  parcelsOutForDelivery?: number;
  shipmentsCreated?: number;
  parcelsInTransit?: number;
  parcelsDelivered?: number;
  shipmentsInTransit?: number;
  shipmentsArrived?: number;
  activeRiders?: number;
}

export interface RiderLocation {
  riderId: string;
  lat: number;
  lng: number;
  heading: number;
  speedKmh: number;
  updatedAt: string;
  warehouseId?: string;
}

export interface AssignmentStop {
  assignmentId: string;
  sequenceNumber: number;
  status: 'ASSIGNED' | 'PICKED' | 'DELIVERED' | 'FAILED';
  destAddress: string;
  destLat: number;
  destLng: number;
  orderId: string;
  orderNo: string;
  estimatedArrivalAt?: string;
}

export interface LiveRider {
  riderId: string;
  riderName?: string;
  lat: number;
  lng: number;
  heading: number;
  speedKmh: number;
  updatedAt: string;
  totalStops: number;
  completedStops: number;
  stops: AssignmentStop[];
}

export type WsMessageType = 'RIDER_LOCATION' | 'ORDER_STATUS' | 'VRP_COMPLETE';

export interface WsMessage {
  type: WsMessageType;
  [key: string]: unknown;
}

export interface VrpBatchRun {
  id: string;
  city: string;
  status: 'RUNNING' | 'COMPLETE' | 'FAILED';
  ordersInput: number;
  ridersAssigned: number;
  startedAt: string;
  completedAt?: string;
}
