import { apiClient } from '@/lib/apiClient';

// ─── Backend response shapes ───────────────────────────────────────────────

export interface BackendWarehouse {
  id: string;
  name: string;
  city: string;
  state: string;
  address: string;
  lat: number;
  lng: number;
  capacityMaxParcels: number;
  capacityMaxKg: number;
  type: 'STAGING' | 'REGIONAL' | 'LAST_MILE_DEPOT';
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
}

export type BackendParcelStatus =
  | 'CREATED'
  | 'AWAITING_PICKUP'
  | 'PICKED_BY_RIDER'
  | 'AT_WAREHOUSE'
  | 'IN_SHIPMENT'
  | 'IN_TRANSIT'
  | 'AT_DEST_WAREHOUSE'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'RETURNED'
  | 'FAILED';

export interface BackendParcel {
  id: string;
  orderId: string;
  weightKg: number;
  dimensions: string;
  description: string;
  originWarehouseId: string;
  currentWarehouseId: string;
  destinationWarehouseId: string;
  shipmentId?: string;
  pickupRiderId?: string;
  deliveryRiderId?: string;
  status: BackendParcelStatus;
  pickedAt?: string;
  arrivedAtWarehouseAt?: string;
  dispatchedAt?: string;
  deliveredAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type BackendShipmentStatus =
  | 'CREATED'
  | 'ASSIGNED'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'ARRIVED'
  | 'DELIVERED'
  | 'CANCELLED';

export interface BackendShipment {
  id: string;
  shipmentNo: string;
  shipmentType: 'LONG_HAUL' | 'INTER_HUB' | 'LAST_MILE';
  vehicleId?: string;
  originWarehouseId: string;
  destinationWarehouseId: string;
  originCity: string;
  destinationCity: string;
  departureTimeEst: string;
  arrivalTimeEst: string;
  costEstimate?: number;
  status: BackendShipmentStatus;
  parcels: BackendParcel[];
  createdAt: string;
  updatedAt: string;
}

export interface BackendDashboard {
  warehouseId: string;
  warehouseName: string;
  city: string;
  parcelsCreated: number;
  parcelsAwaitingPickup: number;
  parcelsAtWarehouse: number;
  parcelsInShipment: number;
  parcelsOutForDelivery: number;
  parcelsDelivered: number;
  shipmentsCreated: number;
  shipmentsInTransit: number;
  shipmentsArrived: number;
  activeRiders: number;
  activeRider?: number;
}

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  statusCode: number;
}

interface OtpResponse {
  verified: boolean;
}

type WarehouseListResponse = BackendWarehouse[] | ApiResponse<BackendWarehouse[]>;
type DashboardResponse = BackendDashboard | ApiResponse<BackendDashboard>;

function unwrapWarehouseList(response: WarehouseListResponse): BackendWarehouse[] {
  if (Array.isArray(response)) return response;
  return Array.isArray(response?.data) ? response.data : [];
}

function unwrapDashboard(response: DashboardResponse): BackendDashboard {
  const raw = 'data' in response ? response.data : response;
  return {
    ...raw,
    activeRiders: raw.activeRiders ?? raw.activeRider ?? 0,
  };
}

// ─── Warehouse APIs ────────────────────────────────────────────────────────

export const warehouseApi = {
  list: async () =>
    unwrapWarehouseList(await apiClient.get<WarehouseListResponse>('/api/v1/warehouses')),

  get: (id: string) =>
    apiClient.get<BackendWarehouse>(`/api/v1/warehouses/${id}`),

  getDashboard: async (warehouseId: string) =>
    unwrapDashboard(await apiClient.get<DashboardResponse>(
      `/api/v1/admin/warehouse/${warehouseId}/dashboard`
    )),
};

// ─── Parcel APIs ───────────────────────────────────────────────────────────

export const parcelApi = {
  getById: (parcelId: string) =>
    apiClient.get<ApiResponse<BackendParcel>>(
      `/api/v1/admin/warehouse/parcels/${parcelId}`
    ),

  getByOrderId: (orderId: string) =>
    apiClient.get<ApiResponse<BackendParcel>>(
      `/api/v1/admin/warehouse/parcels/order/${orderId}`
    ),

  getByWarehouse: (warehouseId: string, status?: string) =>
    apiClient.get<ApiResponse<BackendParcel[]>>(
      `/api/v1/admin/warehouse/${warehouseId}/parcels${status ? `?status=${status}` : ''}`
    ),

  getByRider: (riderId: string, role = 'pickup') =>
    apiClient.get<ApiResponse<BackendParcel[]>>(
      `/api/v1/admin/warehouse/riders/${riderId}/parcels?role=${role}`
    ),

  create: (body: {
    orderId: string;
    weightKg: number;
    dimensions?: string;
    description?: string;
    originWarehouseId: string;
    destinationWarehouseId: string;
  }) =>
    apiClient.post<ApiResponse<BackendParcel>>(
      '/api/v1/admin/warehouse/parcels',
      body
    ),

  assignPickupRider: (parcelId: string, riderId: string) =>
    apiClient.post<ApiResponse<null>>(
      '/api/v1/admin/warehouse/parcels/assign-pickup-rider',
      { parcelId, riderId }
    ),

  assignDeliveryRider: (parcelId: string, riderId: string) =>
    apiClient.post<ApiResponse<null>>(
      '/api/v1/admin/warehouse/parcels/assign-delivery-rider',
      { parcelId, riderId }
    ),

  initiateWarehouseIn: (parcelId: string) =>
    apiClient.post<ApiResponse<null>>(
      `/api/v1/admin/warehouse/parcels/${parcelId}/initiate-warehouse-in`,
      {}
    ),

  verifyWarehouseIn: (parcelId: string, otp: string, performedBy: string) =>
    apiClient.post<ApiResponse<OtpResponse>>(
      '/api/v1/admin/warehouse/parcels/verify-warehouse-in',
      { parcelId, otp, performedBy }
    ),

  verifyWarehouseOut: (parcelId: string, otp: string, performedBy: string) =>
    apiClient.post<ApiResponse<OtpResponse>>(
      '/api/v1/admin/warehouse/parcels/verify-warehouse-out',
      { parcelId, otp, performedBy }
    ),

  verifySellerOtp: (parcelId: string, otp: string, performedBy: string) =>
    apiClient.post<ApiResponse<OtpResponse>>(
      '/api/v1/admin/warehouse/parcels/verify-seller-otp',
      { parcelId, otp, performedBy }
    ),

  verifyCustomerOtp: (parcelId: string, otp: string, performedBy: string) =>
    apiClient.post<ApiResponse<OtpResponse>>(
      '/api/v1/admin/warehouse/parcels/verify-customer-otp',
      { parcelId, otp, performedBy }
    ),
};

// ─── Shipment APIs ─────────────────────────────────────────────────────────

export const shipmentApi = {
  create: (body: {
    shipmentType: 'LONG_HAUL' | 'INTER_HUB' | 'LAST_MILE';
    originWarehouseId: string;
    destinationWarehouseId: string;
    parcelIds?: string[];
    vehicleId?: string;
    departureTimeEst: string;
    arrivalTimeEst: string;
  }) =>
    apiClient.post<ApiResponse<BackendShipment>>(
      '/api/v1/admin/warehouse/shipments',
      body
    ),

  getById: (shipmentId: string) =>
    apiClient.get<ApiResponse<BackendShipment>>(
      `/api/v1/admin/warehouse/shipments/${shipmentId}`
    ),

  getByWarehouse: (warehouseId: string, status?: string) =>
    apiClient.get<ApiResponse<BackendShipment[]>>(
      `/api/v1/admin/warehouse/${warehouseId}/shipments${status ? `?status=${status}` : ''}`
    ),

  addParcels: (shipmentId: string, parcelIds: string[]) =>
    apiClient.post<ApiResponse<null>>(
      `/api/v1/admin/warehouse/shipments/${shipmentId}/parcels`,
      { parcelIds }
    ),

  updateStatus: (shipmentId: string, status: BackendShipmentStatus) =>
    apiClient.patch<ApiResponse<null>>(
      `/api/v1/admin/warehouse/shipments/${shipmentId}/status?status=${status}`
    ),

  autoAssign: (orderId: string, createIfMissing = true) =>
    apiClient.post<ApiResponse<{ shipmentId: string }>>(
      '/api/v1/admin/warehouse/shipments/auto-assign',
      { orderId, createIfMissing }
    ),
};

// ─── VRP APIs ─────────────────────────────────────────────────────────────

export const vrpApi = {
  trigger: (warehouseIds?: string[]) =>
    apiClient.post<ApiResponse<{ batchRunIds: string[]; warehousesQueued: number }>>(
      '/api/v1/admin/vrp/trigger',
      { warehouseIds: warehouseIds ?? null, dryRun: false }
    ),

  getRunStatus: (batchRunId: string) =>
    apiClient.get<ApiResponse<{
      id: string; city: string; status: string;
      ordersInput: number; ridersAssigned: number;
      startedAt: string; completedAt?: string;
    }>>(`/api/v1/admin/vrp/runs/${batchRunId}`),

  getRunningRuns: () =>
    apiClient.get<ApiResponse<Array<{
      id: string; city: string; status: string; startedAt: string;
    }>>>('/api/v1/admin/vrp/runs'),
};

// ─── Rider / Live Dashboard APIs ──────────────────────────────────────────

export const riderApi = {
  getLiveRiders: (warehouseId: string) =>
    apiClient.get<ApiResponse<Array<Record<string, string>>>>(
      `/api/v1/riders/admin/warehouse/${warehouseId}/riders/live`
    ),

  getTodayRoute: (riderId: string) =>
    apiClient.get<ApiResponse<{
      batchRunId: string;
      totalStops: number;
      completedStops: number;
      assignments: Array<{
        assignmentId: string;
        sequenceNumber: number;
        status: string;
        order: { orderId: string; destAddress: string; destLat: number; destLng: number; orderNo: string };
        estimatedArrivalAt?: string;
      }>;
    }>>(`/api/v1/riders/${riderId}/route/today`),
};

// ─── Zone APIs (DeliveryInventoryService :8083) ───────────────────────────

import type { ServiceZone, CreateZonePayload, ZoneCheckResponse } from '@/types/zone';

export const zoneApi = {
  /** Admin: full CRUD */
  list: () =>
    apiClient.get<ServiceZone[]>('/api/v1/admin/service-zones'),

  get: (id: string) =>
    apiClient.get<ServiceZone>(`/api/v1/admin/service-zones/${id}`),

  create: (body: CreateZonePayload) =>
    apiClient.post<ServiceZone>('/api/v1/admin/service-zones', body),

  update: (id: string, body: CreateZonePayload) =>
    apiClient.put<ServiceZone>(`/api/v1/admin/service-zones/${id}`, body),

  toggleStatus: (id: string) =>
    apiClient.patch<ServiceZone>(`/api/v1/admin/service-zones/${id}/status`),

  delete: (id: string) =>
    apiClient.delete<void>(`/api/v1/admin/service-zones/${id}`),

  rebuildCache: () =>
    apiClient.post<string>('/api/v1/admin/service-zones/cache/rebuild', {}),

  /** Public: eligibility check */
  check: (lat: number, lng: number, type: 'USER' | 'SELLER' = 'USER') =>
    apiClient.get<ZoneCheckResponse>(
      `/api/v1/zones/check?lat=${lat}&lng=${lng}&type=${type}`
    ),

  activeForTarget: (type: 'USER' | 'SELLER' = 'USER') =>
    apiClient.get<ServiceZone[]>(`/api/v1/zones/active?type=${type}`),
};

// ─── Mapping helpers ───────────────────────────────────────────────────────

import type { Order, Parcel } from '@/types/warehouse';

export function mapParcelStatusToFrontend(status: BackendParcelStatus): Order['status'] {
  switch (status) {
    case 'CREATED':
    case 'AWAITING_PICKUP':
    case 'PICKED_BY_RIDER':
      return 'PENDING';
    case 'AT_WAREHOUSE':
      return 'RECEIVED';
    case 'IN_SHIPMENT':
      return 'IN_PARCEL';
    default:
      return 'DISPATCHED';
  }
}

export function mapBackendParcelToOrder(
  p: BackendParcel,
  warehouseMap: Record<string, BackendWarehouse>
): Order {
  const destCity = warehouseMap[p.destinationWarehouseId]?.city ?? p.destinationWarehouseId;
  const currCity = warehouseMap[p.currentWarehouseId]?.city ?? p.currentWarehouseId;
  return {
    id: p.id,
    qrCode: p.id,
    currentCity: currCity,
    nextDestination: destCity,
    routeSequence: 1,
    status: mapParcelStatusToFrontend(p.status),
    receivedAt: p.arrivedAtWarehouseAt ? new Date(p.arrivedAtWarehouseAt) : undefined,
    parcelId: p.shipmentId,
  };
}

export function mapShipmentStatusToFrontend(status: BackendShipmentStatus): Parcel['status'] {
  switch (status) {
    case 'CREATED':
      return 'OPEN';
    case 'ASSIGNED':
    case 'PICKED_UP':
      return 'READY_TO_DISPATCH';
    case 'IN_TRANSIT':
      return 'DISPATCHED';
    default:
      return 'RECEIVED';
  }
}

export function mapBackendShipmentToParcel(s: BackendShipment): Parcel {
  return {
    id: s.id,
    qrCode: s.id,
    destinationCity: s.destinationCity,
    currentWarehouse: s.originCity,
    orders: s.parcels?.map(p => p.id) ?? [],
    status: mapShipmentStatusToFrontend(s.status),
    createdAt: new Date(s.createdAt),
    dispatchedAt: s.status === 'IN_TRANSIT' ? new Date(s.updatedAt) : undefined,
  };
}
