export type ZoneShapeType = 'CIRCLE' | 'POLYGON';
export type ZoneTarget    = 'USER' | 'SELLER' | 'BOTH';
export type ZoneStatus    = 'ACTIVE' | 'INACTIVE';

export interface LatLngPoint {
  lat: number;
  lng: number;
}

export interface ServiceZone {
  id: string;
  name: string;
  city: string;
  description?: string;
  shapeType: ZoneShapeType;
  target: ZoneTarget;
  status: ZoneStatus;
  // CIRCLE
  centerLat?: number;
  centerLng?: number;
  radiusMeters?: number;
  // POLYGON
  polygonPoints?: LatLngPoint[];
  createdAt: string;
  updatedAt: string;
}

export interface ZoneCheckResponse {
  serviceable: boolean;
  zoneId?: string;
  zoneName?: string;
  message: string;
}

export interface CreateZonePayload {
  name: string;
  city: string;
  description?: string;
  shapeType: ZoneShapeType;
  target: ZoneTarget;
  // CIRCLE
  centerLat?: number;
  centerLng?: number;
  radiusMeters?: number;
  // POLYGON
  polygonPoints?: LatLngPoint[];
}
