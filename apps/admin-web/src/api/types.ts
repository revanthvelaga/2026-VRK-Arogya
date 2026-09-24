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
  scheduledAt: string;
  status: BookingStatus;
  subtotal: string | number;
  gstAmount: string | number;
  totalAmount: string | number;
  paymentStatus: PaymentStatus;
  createdAt: string;
  items: BookingItem[];
  // Filled in by the API for admin/staff requests only.
  customer?: BookingCustomer;
  patient?: BookingPatient;
  // Filled in for every caller, the booking's own customer included —
  // where the sample is collected from and who's collecting it.
  centerName?: string;
  centerAddress?: string;
  pickupPointName?: string;
  assignedAgent?: BookingAgent;
  // Home-visit check-in: the agent taps "On my way", then enters the
  // customer's door code on arrival.
  agentEnRouteAt?: string;
  agentEtaAt?: string;
  agentArrivedAt?: string;
  preparation?: Array<{ testName: string; instructions: string }>;
}

export interface BookingCustomer {
  fullName: string;
  phone?: string;
  email?: string;
}

export interface BookingPatient {
  fullName: string;
  relationship: string;
  gender?: string;
  dateOfBirth?: string;
  phone?: string;
}

export interface BookingAgent {
  id: string;
  fullName: string;
  phone?: string;
}

export interface StaffMember {
  id: string;
  fullName: string;
  phone?: string;
  email?: string;
  role: Role;
  specialization?: string;
  monthlySalary?: string | number;
  isActive: boolean;
  createdAt: string;
}

export interface AgentCollectionRecord {
  sampleId: string;
  bookingId: string;
  scheduledAt: string;
  collectedAt: string;
  onTime: boolean | null;
  safetyIdVerified: boolean | null;
  safetyPpeUsed: boolean | null;
  safetyHygieneFollowed: boolean | null;
}

export interface AgentUpcomingBooking {
  bookingId: string;
  scheduledAt: string;
  status: BookingStatus;
  collectionMode: CollectionMode;
  centerName?: string;
}

export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface LeaveRecord {
  id: string;
  startDate: string;
  endDate: string;
  leaveType: string;
  reason?: string;
  status: LeaveStatus;
  createdAt: string;
}

export interface AgentLeaveRecord extends LeaveRecord {
  agentId: string;
  agentName: string;
  agentPhone?: string;
}

export interface Holiday {
  date: string;
  name: string;
  tentative: boolean;
}

export interface CertificateSummary {
  id: string;
  title: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface ProfileResponse {
  id: string;
  fullName: string;
  phone?: string;
  email?: string;
  role: Role;
  specialization?: string;
  dateOfBirth?: string;
  gender?: string;
  addressLine?: string;
  city?: string;
  state?: string;
  pincode?: string;
  qualification?: string;
  institution?: string;
  graduationYear?: number;
  isActive: boolean;
  createdAt: string;
  completionPercent: number;
  missingFields: string[];
  certificateCount: number;
}

export interface AgentDetail {
  agent: StaffMember;
  profile: ProfileResponse;
  monthlySalary?: string | number;
  certificates: CertificateSummary[];
  leaves: LeaveRecord[];
  performance: {
    totalCollections: number;
    onTimeCount: number;
    onTimeRate: number;
    safetyCompliantCount: number;
    safetyComplianceRate: number;
    recent: AgentCollectionRecord[];
    ratingAverage: number | null;
    ratingCount: number;
    recentRatings: Array<{ bookingId: string; rating: number; comment?: string; createdAt: string }>;
  };
  upcoming: AgentUpcomingBooking[];
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
  onTimeCollection?: boolean;
  safetyIdVerified?: boolean;
  safetyPpeUsed?: boolean;
  safetyHygieneFollowed?: boolean;
  sampleBarcode?: string;
}

export type SampleImageKind = 'COLLECTION' | 'DROP_OFF';

export interface SampleImage {
  id: string;
  sampleId: string;
  kind: SampleImageKind;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
  createdAt: string;
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

export const AUDIENCE_OPTIONS: { value: Audience; label: string }[] = [
  { value: 'EVERYONE', label: 'Everyone (no specific audience)' },
  { value: 'MEN', label: 'Men' },
  { value: 'WOMEN', label: 'Women' },
  { value: 'CHILDREN', label: 'Children' },
  { value: 'SENIOR_MEN', label: 'Senior men' },
  { value: 'SENIOR_WOMEN', label: 'Senior women' },
  { value: 'FITNESS', label: 'Fitness' },
];

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
  tier?: 'BASIC' | 'STANDARD' | 'PREMIUM' | null;
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

export interface PrescriptionMatch {
  writtenAs: string;
  kind: 'test' | 'package' | null;
  catalogId: string | null;
  name: string | null;
  price: number | null;
  confidence: 'high' | 'medium' | 'low';
}

export interface PrescriptionRecord {
  id: string;
  customerId: string;
  customerName?: string;
  customerPhone?: string;
  fileName: string;
  mimeType: string;
  matches: PrescriptionMatch[];
  notes?: string;
  doctorName?: string;
  status: 'NEW' | 'REVIEWED';
  createdAt: string;
}
