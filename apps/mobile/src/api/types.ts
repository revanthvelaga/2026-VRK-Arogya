export type Role = 'ADMIN' | 'STAFF' | 'CUSTOMER';

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  role: Role;
}

export interface JwtPayload {
  sub: string;
  phone: string;
  role: Role;
  iat: number;
  exp: number;
}

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
export type CollectionMode = 'WALK_IN' | 'PICKUP_POINT' | 'HOME_VISIT';

export type SampleStatus =
  | 'BOOKED'
  | 'COLLECTED'
  | 'IN_TRANSIT_TO_CENTER'
  | 'AT_CENTER'
  | 'IN_HOUSE_PROCESSING'
  | 'ROUTED_TO_PARTNER_LAB'
  | 'RESULT_READY'
  | 'DELIVERED';

export interface BookingItem {
  id: string;
  bookingId: string;
  testId?: string;
  packageId?: string;
  price: string | number;
}

export interface Booking {
  id: string;
  customerId: string;
  centerId: string;
  pickupPointId?: string;
  collectionMode: CollectionMode;
  scheduledAt: string;
  status: BookingStatus;
  totalAmount: string | number;
  createdAt: string;
  items: BookingItem[];
}

export interface Sample {
  id: string;
  bookingId: string;
  bookingItemId: string;
  collectedBy?: string;
  status: SampleStatus;
  collectedAt?: string;
  routedToPartnerLabId?: string;
  expectedResultAt?: string;
  updatedAt: string;
}

export interface SampleStatusHistoryEntry {
  id: string;
  sampleId: string;
  status: SampleStatus;
  changedBy?: string;
  changedAt: string;
  notes?: string;
}

export type Audience = 'EVERYONE' | 'MEN' | 'WOMEN' | 'CHILDREN' | 'SENIOR_MEN' | 'SENIOR_WOMEN' | 'FITNESS';

export interface Test {
  id: string;
  centerId?: string;
  name: string;
  code?: string;
  sampleType?: string;
  price: string | number;
  isInHouse: boolean;
  partnerLabId?: string;
  turnaroundHours: number;
  audience: Audience;
  isActive: boolean;
  createdAt: string;
}

export interface Package {
  id: string;
  centerId?: string;
  name: string;
  description?: string;
  price: string | number;
  audience: Audience;
  isActive: boolean;
  createdAt: string;
  tests?: Test[];
}

export interface GeoPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export interface DiagnosticCenter {
  id: string;
  name: string;
  address?: string;
  location: GeoPoint;
  serviceRadiusKm: string | number;
  ownerId?: string;
  isActive: boolean;
  createdAt: string;
}

export interface PickupPoint {
  id: string;
  centerId: string;
  name: string;
  location: GeoPoint;
  villageName?: string;
  distanceKm?: string | number;
  isActive: boolean;
  createdAt: string;
}
