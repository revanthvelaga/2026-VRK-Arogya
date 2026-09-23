export type Role = 'ADMIN' | 'STAFF' | 'CUSTOMER';

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  role: Role;
}

export interface JwtPayload {
  sub: string;
  phone?: string;
  role: Role;
  iat: number;
  exp: number;
}

export interface ProfileResponse {
  id: string;
  fullName: string;
  phone?: string;
  email?: string;
  role: Role;
  dateOfBirth?: string;
  gender?: string;
  addressLine?: string;
  city?: string;
  state?: string;
  pincode?: string;
  isActive: boolean;
  createdAt: string;
  completionPercent: number;
  missingFields: string[];
}

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
export type CollectionMode = 'WALK_IN' | 'PICKUP_POINT' | 'HOME_VISIT';
export type Relationship = 'SELF' | 'SPOUSE' | 'CHILD' | 'PARENT' | 'SIBLING' | 'OTHER';
export type Gender = 'MALE' | 'FEMALE' | 'OTHER';
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED';
export type IssueStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';

export type SampleStatus =
  | 'BOOKED'
  | 'COLLECTED'
  | 'IN_TRANSIT_TO_CENTER'
  | 'AT_CENTER'
  | 'IN_HOUSE_PROCESSING'
  | 'ROUTED_TO_PARTNER_LAB'
  | 'RESULT_READY'
  | 'DELIVERED';

export const SAMPLE_STATUS_ORDER: SampleStatus[] = [
  'BOOKED',
  'COLLECTED',
  'IN_TRANSIT_TO_CENTER',
  'AT_CENTER',
  'IN_HOUSE_PROCESSING',
  'ROUTED_TO_PARTNER_LAB',
  'RESULT_READY',
  'DELIVERED',
];

// Mirrors SamplesService's ALLOWED_TRANSITIONS on the API side.
export const SAMPLE_TRANSITIONS: Record<SampleStatus, SampleStatus[]> = {
  BOOKED: ['COLLECTED'],
  COLLECTED: ['IN_TRANSIT_TO_CENTER'],
  IN_TRANSIT_TO_CENTER: ['AT_CENTER'],
  AT_CENTER: ['IN_HOUSE_PROCESSING', 'ROUTED_TO_PARTNER_LAB'],
  IN_HOUSE_PROCESSING: ['RESULT_READY'],
  ROUTED_TO_PARTNER_LAB: ['RESULT_READY'],
  RESULT_READY: ['DELIVERED'],
  DELIVERED: [],
};

export interface BookingItem {
  id: string;
  bookingId: string;
  testId?: string;
  packageId?: string;
  price: string | number;
}

export interface Patient {
  id: string;
  accountId: string;
  fullName: string;
  relationship: Relationship;
  gender?: Gender;
  dateOfBirth?: string;
  areaAddress?: string;
  pincode?: string;
  fullAddress?: string;
  landmark?: string;
  location?: GeoPoint;
  phone?: string;
  alternatePhone?: string;
  isActive: boolean;
  createdAt: string;
}

export interface Booking {
  id: string;
  customerId: string;
  patientId?: string;
  centerId: string;
  pickupPointId?: string;
  assignedAgentId?: string;
  collectionMode: CollectionMode;
  homeAddressLine?: string;
  homeAddressPincode?: string;
  homeLocation?: GeoPoint;
  scheduledAt: string;
  status: BookingStatus;
  subtotal: string | number;
  gstAmount: string | number;
  totalAmount: string | number;
  paymentStatus: PaymentStatus;
  createdAt: string;
  items: BookingItem[];
  // Where the sample is collected from and who's collecting it — always
  // present for the booking's own customer, same as centerName below.
  centerName?: string;
  centerAddress?: string;
  pickupPointName?: string;
  assignedAgent?: BookingAgent;
}

export interface BookingAgent {
  id: string;
  fullName: string;
  phone?: string;
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
  category?: string;
  description?: string;
  preparationInstructions?: string;
  reportInfo?: string;
  normalRangeLow?: string | number;
  normalRangeHigh?: string | number;
  normalRangeUnit?: string;
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

export interface GeocodeResult {
  displayName: string;
  lat: number;
  lng: number;
  pincode?: string;
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

export interface PickupPointSchedule {
  id: string;
  pickupPointId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface PartnerLab {
  id: string;
  name: string;
  city?: string;
  contactPhone?: string;
  defaultTurnaroundHours: number;
  createdAt: string;
}

export type SlaStatus = 'NOT_TRACKED' | 'IN_PROGRESS' | 'AT_RISK' | 'ON_TIME' | 'BREACHED';

export interface SampleSlaRow {
  sampleId: string;
  bookingId: string;
  status: SampleStatus;
  expectedResultAt: string | null;
  actualResultAt: string | null;
  slaStatus: SlaStatus;
}

export interface SlaSummary {
  summary: {
    total: number;
    onTime: number;
    breached: number;
    atRisk: number;
    inProgress: number;
    notTracked: number;
  };
  samples: SampleSlaRow[];
}

export interface Report {
  id: string;
  bookingId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
  generatedAt: string;
  reviewedBy?: string;
}

export interface ReportValue {
  id: string;
  reportId: string;
  testId?: string;
  testName: string;
  category?: string;
  value: string | number;
  unit?: string;
  normalLow?: string | number;
  normalHigh?: string | number;
  isAbnormal: boolean;
  createdAt: string;
  previousValue?: string | number;
  previousUnit?: string;
  previousRecordedAt?: string;
}

export interface MyReportValue extends ReportValue {
  bookingId: string;
  reportGeneratedAt: string;
  reportFileName: string;
}

export interface Issue {
  id: string;
  bookingId: string;
  raisedBy: string;
  subject: string;
  description: string;
  status: IssueStatus;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  bookingId: string;
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  amount: string | number;
  currency: string;
  status: PaymentStatus;
  createdAt: string;
}

export interface RazorpayOrder {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
}
