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
  orderId?: string | null;
  weightKg: number;
  dimensions?: string | null;
  description?: string | null;
  originWarehouseId?: string | null;
  currentWarehouseId?: string | null;
  destinationWarehouseId?: string | null;
  shipmentId?: string;
  pickupRiderId?: string;
  deliveryRiderId?: string;
  status: BackendParcelStatus;
  // OTP checkpoint flags — present on all parcel responses
  sellerPickupOtpVerified: boolean;
  warehouseInOtpVerified: boolean;
  warehouseOutOtpVerified: boolean;
  customerDeliveryOtpVerified: boolean;
  pickedAt?: string;
  arrivedAtWarehouseAt?: string;
  dispatchedAt?: string;
  deliveredAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export type BackendShipmentStatus =
  | 'CREATED'
  | 'ASSIGNED'
  | 'DISPATCHED'
  | 'IN_TRANSIT'
  | 'AT_DESTINATION'
  | 'DELIVERED'
  | 'CANCELLED';

export interface BackendShipment {
  id: string;
  shipmentNo: string;
  shipmentType: 'LONG_HAUL' | 'INTER_HUB' | 'LAST_MILE';
  vehicleId?: string;
  riderId?: string;
  originWarehouseId: string;
  destinationWarehouseId: string;
  originCity: string;
  destinationCity: string;
  parcelCount?: number;
  totalWeightKg?: number;
  departureTimeEst: string;
  arrivalTimeEst: string;
  costEstimate?: number;
  status: BackendShipmentStatus;
  parcels?: BackendParcel[];
  createdAt: string;
  updatedAt?: string;
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

  update: (parcelId: string, body: {
    weightKg?: number;
    dimensions?: string;
    description?: string;
    destinationWarehouseId?: string;
  }) =>
    apiClient.patch<ApiResponse<BackendParcel>>(
      `/api/v1/admin/warehouse/parcels/${parcelId}`,
      body
    ),

  remove: (parcelId: string) =>
    apiClient.delete<ApiResponse<null>>(
      `/api/v1/admin/warehouse/parcels/${parcelId}`
    ),
};

// ─── Batch Handover Session APIs ──────────────────────────────────────────
//
// Industry-standard flow: one OTP authenticates the rider, admin scans each
// order barcode, then confirms the whole batch at once.

export interface HandoverSessionStart {
  sessionId: string;
  riderName: string;
  riderPhoneMasked: string;
  message: string;
}

export interface ScannedOrderItem {
  orderNo: string;
  orderId: string;
  destCity: string;
  weightKg: number;
}

export interface ScanOrderResult {
  orderNo: string;
  orderId?: string;
  accepted: boolean;
  reason?: string;
  totalScanned: number;
  scannedOrders: ScannedOrderItem[];
}

export interface HandoverSessionStatus {
  sessionId: string;
  riderId: string;
  riderName: string;
  status: 'PENDING_OTP' | 'ACTIVE' | 'COMPLETED';
  totalScanned: number;
  scannedOrders: ScannedOrderItem[];
}

export interface ConfirmHandoverResult {
  accepted: number;
  skipped: number;
  acceptedOrderNos: string[];
  skippedOrderNos: string[];
  errors: string[];
}

export const handoverApi = {
  /** Step 1: admin selects rider → OTP SMSd to rider */
  startSession: (warehouseId: string, riderId: string) =>
    apiClient.post<ApiResponse<HandoverSessionStart>>(
      `/api/v1/admin/warehouse/${warehouseId}/receive/session/start`,
      { riderId }
    ),

  /** Step 2: rider gives OTP to admin → session ACTIVE */
  verifyOtp: (warehouseId: string, sessionId: string, otp: string) =>
    apiClient.post<ApiResponse<HandoverSessionStatus>>(
      `/api/v1/admin/warehouse/${warehouseId}/receive/session/${sessionId}/verify-otp`,
      { otp }
    ),

  /** Step 3: scan one order barcode (call once per package) */
  scanOrder: (warehouseId: string, sessionId: string, orderNo: string) =>
    apiClient.post<ApiResponse<ScanOrderResult>>(
      `/api/v1/admin/warehouse/${warehouseId}/receive/session/${sessionId}/scan`,
      { orderNo }
    ),

  /** Remove a mistakenly scanned order */
  removeOrder: (warehouseId: string, sessionId: string, orderNo: string) =>
    apiClient.delete<ApiResponse<ScanOrderResult>>(
      `/api/v1/admin/warehouse/${warehouseId}/receive/session/${sessionId}/scan/${encodeURIComponent(orderNo)}`
    ),

  /** Get current session state */
  getSession: (warehouseId: string, sessionId: string) =>
    apiClient.get<ApiResponse<HandoverSessionStatus>>(
      `/api/v1/admin/warehouse/${warehouseId}/receive/session/${sessionId}`
    ),

  /** Step 4: commit all scanned orders to WAREHOUSE status */
  confirm: (warehouseId: string, sessionId: string) =>
    apiClient.post<ApiResponse<ConfirmHandoverResult>>(
      `/api/v1/admin/warehouse/${warehouseId}/receive/session/${sessionId}/confirm`,
      {}
    ),
};

// ─── Receive-Order-by-orderNo APIs ────────────────────────────────────────
//
// Drives the "Receive Orders" page: admin types an orderNo (e.g. OR123456),
// the rider gets an OTP via SMS, admin verifies the OTP rider provides.

export interface ReceiveOrderLookup {
  orderId: string;
  orderNo: string;
  orderStatus: string;
  parcelId?: string;
  parcelStatus?: BackendParcelStatus;
  weightKg: number;
  originCity: string;
  destCity: string;
  currentWarehouseId?: string;
  destinationWarehouseId?: string;
  riderId?: string;
  riderName?: string;
  riderPhoneMasked?: string;
  canReceive: boolean;
  alreadyReceived?: boolean;
  reason?: string;
}

export const orderReceiveApi = {
  lookup: (warehouseId: string, orderNo: string) =>
    apiClient.get<ApiResponse<ReceiveOrderLookup>>(
      `/api/v1/admin/warehouse/${warehouseId}/receive/lookup?orderNo=${encodeURIComponent(orderNo)}`
    ),

  initiate: (warehouseId: string, orderNo: string) =>
    apiClient.post<ApiResponse<unknown>>(
      `/api/v1/admin/warehouse/${warehouseId}/receive/initiate`,
      { orderNo }
    ),

  verify: (warehouseId: string, orderNo: string, otp: string, performedBy: string) =>
    apiClient.post<ApiResponse<BackendParcel>>(
      `/api/v1/admin/warehouse/${warehouseId}/receive/verify`,
      { orderNo, otp, performedBy }
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

  update: (shipmentId: string, body: {
    vehicleId?: string;
    shipmentType?: 'LONG_HAUL' | 'INTER_HUB' | 'LAST_MILE';
    departureTimeEst?: string;
    arrivalTimeEst?: string;
    costEstimate?: number;
  }) =>
    apiClient.patch<ApiResponse<BackendShipment>>(
      `/api/v1/admin/warehouse/shipments/${shipmentId}`,
      body
    ),

  remove: (shipmentId: string) =>
    apiClient.delete<ApiResponse<null>>(
      `/api/v1/admin/warehouse/shipments/${shipmentId}`
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

export interface RiderAssignmentStop {
  assignmentId: string;
  orderId: string;
  sequenceNumber: number;
  status: string;
  destAddress: string;
  destCity: string;
  destLat?: number;
  destLng?: number;
  weightKg: number;
}

export interface RiderAssignmentBundle {
  riderId: string;
  riderName: string;
  riderPhone?: string;
  currentLat: number;
  currentLng: number;
  totalStops: number;
  completed: number;
  assignments: RiderAssignmentStop[];
}

export const riderApi = {
  getRouteAssignments: (warehouseId: string) =>
    apiClient.get<ApiResponse<RiderAssignmentBundle[]>>(
      `/api/v1/admin/warehouse/${warehouseId}/route-assignments`
    ),

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

// ─── Order APIs ────────────────────────────────────────────────────────────

export type BackendOrderStatus =
  | 'CREATED'
  | 'PICKUP_SCHEDULED'
  | 'PICKED'
  | 'WAREHOUSE'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'PENDING'
  | 'ASSIGNED';

export interface BackendOrder {
  id: string;
  orderNo: string;
  originAddress: string;
  originCity: string;
  destAddress: string;
  destCity: string;
  weightKg: number;
  status: BackendOrderStatus;
  serviceType: 'STANDARD' | 'EXPRESS';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  wareHouseId?: string;
  placedAt?: string;
  createdAt: string;
  // Rider info (populated by backend when riderId is set)
  riderId?: string;
  riderName?: string;
  riderPhone?: string;
  riderCity?: string;
  riderStatus?: string;
  riderLat?: number;
  riderLng?: number;
}

export const orderApi = {
  getByWarehouse: (warehouseId: string, status?: string) =>
    apiClient.get<ApiResponse<BackendOrder[]>>(
      `/api/v1/admin/warehouse/${warehouseId}/orders${status ? `?status=${status}` : ''}`
    ),
};

// ─── Route / Tracking APIs ─────────────────────────────────────────────────

export interface TrackingEvent {
  eventType: string;
  label: string;
  warehouseId?: string;
  warehouseCity?: string;
  warehouseName?: string;
  shipmentId?: string;
  shipmentNo?: string;
  timestamp?: string;
  performedBy?: string;
  completed: boolean;
}

export interface ParcelTrackingRoute {
  parcelId: string;
  orderId: string;
  orderNo?: string;
  currentStatus: BackendParcelStatus;
  events: TrackingEvent[];
}

export const trackingApi = {
  getParcelRoute: (parcelId: string) =>
    apiClient.get<ApiResponse<ParcelTrackingRoute>>(
      `/api/v1/admin/warehouse/parcels/${parcelId}/route`
    ),

  getOrderRoute: (orderId: string) =>
    apiClient.get<ApiResponse<ParcelTrackingRoute>>(
      `/api/v1/admin/orders/${orderId}/route`
    ),

  getShipmentRoute: (shipmentId: string) =>
    apiClient.get<ApiResponse<ParcelTrackingRoute>>(
      `/api/v1/admin/warehouse/shipments/${shipmentId}/route`
    ),
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
    dispatchedAt: s.status === 'IN_TRANSIT' && s.updatedAt ? new Date(s.updatedAt) : undefined,
  };
}

// ─── Shipment Transfer Session APIs ───────────────────────────────────────
//
// Session-based handoff covering every physical transfer in the shipment journey:
//   DISPATCH_OUT         Warehouse admin → outgoing rider       (ASSIGNED → PICKED_UP)
//   HAND_TO_VEHICLE      Rider → vehicle/transporter            (PICKED_UP → IN_TRANSIT)
//   RECEIVE_FROM_VEHICLE Vehicle → destination rider            (IN_TRANSIT → ARRIVED)
//   RECEIVE_IN           Incoming rider → destination warehouse  (ARRIVED → DELIVERED)

export type ShipmentTransferSessionType =
  | 'DISPATCH_OUT'
  | 'HAND_TO_VEHICLE'
  | 'RECEIVE_FROM_VEHICLE'
  | 'RECEIVE_IN';

export interface StartShipmentTransferResponse {
  sessionId: string;
  sessionType: ShipmentTransferSessionType;
  partyName: string;
  partyPhoneMasked: string;
  message: string;
}

export interface ScannedShipmentItem {
  shipmentNo: string;
  shipmentId: string;
  originCity: string;
  destinationCity: string;
  parcelCount: number;
  currentStatus: BackendShipmentStatus;
}

export interface ScanShipmentResult {
  shipmentNo: string;
  accepted: boolean;
  reason?: string;
  totalScanned: number;
  scannedShipments: ScannedShipmentItem[];
}

export interface ShipmentTransferSessionStatus {
  sessionId: string;
  sessionType: ShipmentTransferSessionType;
  riderId?: string;
  partyName: string;
  partyPhoneMasked: string;
  status: 'PENDING_OTP' | 'ACTIVE' | 'COMPLETED';
  totalScanned: number;
  scannedShipments: ScannedShipmentItem[];
}

export interface ConfirmTransferResult {
  processed: number;
  skipped: number;
  processedShipmentNos: string[];
  skippedShipmentNos: string[];
  errors: string[];
}

export const shipmentTransferApi = {
  /** Step 1 — start a session; OTP sent to receiving party */
  startSession: (
    warehouseId: string,
    body: {
      sessionType: ShipmentTransferSessionType;
      /** DISPATCH_OUT only: any shipment number from the batch — rider is auto-resolved from it */
      referenceShipmentNo?: string;
      /** RECEIVE_IN only: rider delivering the arriving shipments */
      riderId?: string;
      /** HAND_TO_VEHICLE / RECEIVE_FROM_VEHICLE: driver phone + name */
      partyPhone?: string;
      partyName?: string;
    }
  ) =>
    apiClient.post<ApiResponse<StartShipmentTransferResponse>>(
      `/api/v1/admin/warehouse/${warehouseId}/shipment-transfer/session/start`,
      body
    ),

  /** Step 2 — receiving party gives OTP to initiator; session becomes ACTIVE */
  verifyOtp: (warehouseId: string, sessionId: string, otp: string) =>
    apiClient.post<ApiResponse<ShipmentTransferSessionStatus>>(
      `/api/v1/admin/warehouse/${warehouseId}/shipment-transfer/session/${sessionId}/verify-otp`,
      { otp }
    ),

  /** Step 3 — scan one shipment number (call once per shipment) */
  scanShipment: (warehouseId: string, sessionId: string, shipmentNo: string) =>
    apiClient.post<ApiResponse<ScanShipmentResult>>(
      `/api/v1/admin/warehouse/${warehouseId}/shipment-transfer/session/${sessionId}/scan`,
      { shipmentNo }
    ),

  /** Remove a mistakenly scanned shipment before confirming */
  removeShipment: (warehouseId: string, sessionId: string, shipmentNo: string) =>
    apiClient.delete<ApiResponse<ScanShipmentResult>>(
      `/api/v1/admin/warehouse/${warehouseId}/shipment-transfer/session/${sessionId}/scan/${encodeURIComponent(shipmentNo)}`
    ),

  /** Get current session state + scanned list */
  getSession: (warehouseId: string, sessionId: string) =>
    apiClient.get<ApiResponse<ShipmentTransferSessionStatus>>(
      `/api/v1/admin/warehouse/${warehouseId}/shipment-transfer/session/${sessionId}`
    ),

  /** Step 4 — commit; advance all scanned shipments' status in one shot */
  confirm: (warehouseId: string, sessionId: string) =>
    apiClient.post<ApiResponse<ConfirmTransferResult>>(
      `/api/v1/admin/warehouse/${warehouseId}/shipment-transfer/session/${sessionId}/confirm`,
      {}
    ),
};

// ─── Shipment Planning APIs ────────────────────────────────────────────────
//
// Two-phase planning pipeline:
//   GET  /{warehouseId}/shipment-plan            → generate & cache plan (15 min)
//   POST /{warehouseId}/shipment-plan/{id}/execute → commit plan to DB

export interface PlannedShipmentGroup {
  groupIndex: number;
  destinationWarehouseId: string;
  destinationWarehouseName: string;
  destinationCity: string;
  shipmentType: 'LAST_MILE' | 'INTER_HUB';
  parcelIds: string[];
  parcelCount: number;
  totalWeightKg: number;
  distanceKm: number;
  etaSeconds: number;
  etaFromCache: boolean;
  departureEst: string;
  arrivalEst: string;
  suggestedVehicleId?: string;
  suggestedVehicleNumber?: string;
  suggestedVehicleType?: string;
  suggestedVehicleCapacityKg: number;
}

export interface ShipmentPlan {
  planId: string;
  warehouseId: string;
  originCity: string;
  generatedAt: string;
  totalParcels: number;
  totalGroups: number;
  groups: PlannedShipmentGroup[];
}

export interface ExecuteGroupRequest {
  groupIndex: number;
  vehicleId?: string;
  departureOverride?: string;
}

export interface ExecutePlanRequest {
  groups?: ExecuteGroupRequest[];
}

export interface ExecutePlanResponse {
  created: number;
  skipped: number;
  shipments: BackendShipment[];
  errors: string[];
}

export const shipmentPlanApi = {
  generate: (warehouseId: string) =>
    apiClient.get<ApiResponse<ShipmentPlan>>(
      `/api/v1/admin/warehouse/${warehouseId}/shipment-plan`
    ),

  execute: (warehouseId: string, planId: string, body?: ExecutePlanRequest) =>
    apiClient.post<ApiResponse<ExecutePlanResponse>>(
      `/api/v1/admin/warehouse/${warehouseId}/shipment-plan/${planId}/execute`,
      body ?? {}
    ),
};
