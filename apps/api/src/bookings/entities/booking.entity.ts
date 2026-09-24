import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { CollectionMode } from '../../common/enums/collection-mode.enum';
import { BookingStatus } from '../../common/enums/booking-status.enum';
import { PaymentStatus } from '../../common/enums/payment-status.enum';
import { BookingItem } from './booking-item.entity';
import { GeoPoint } from '../../common/types/geo-point';

@Entity('bookings')
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'customer_id' })
  customerId: string;

  // Nullable only so existing rows from before patient profiles existed
  // don't break — every new booking always sets this (enforced in
  // BookingsService.create, not the DTO, since ownership needs a lookup).
  @Column({ name: 'patient_id', nullable: true })
  patientId?: string;

  @Column({ name: 'center_id' })
  centerId: string;

  @Column({ name: 'pickup_point_id', nullable: true })
  pickupPointId?: string;

  // The staff/admin user (field agent) responsible for collecting this
  // booking's sample and getting it to the center — set by an admin via
  // BookingsService.assignAgent, not by the agent themselves. Nullable:
  // most bookings go unassigned until staff picks one, and a WALK_IN
  // booking may never need one at all.
  @Column({ name: 'assigned_agent_id', nullable: true })
  assignedAgentId?: string;

  @Column({ name: 'collection_mode', type: 'enum', enum: CollectionMode })
  collectionMode: CollectionMode;

  // Set only when collectionMode is HOME_VISIT — where staff should go to
  // collect the sample. Validated against the center's serviceRadiusKm at
  // booking time (see BookingsService.create), not re-checked afterward.
  @Column({ name: 'home_address_line', type: 'text', nullable: true })
  homeAddressLine?: string;

  @Column({ name: 'home_address_pincode', length: 10, nullable: true })
  homeAddressPincode?: string;

  @Column({
    name: 'home_location',
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  homeLocation?: GeoPoint;

  @Column({ name: 'scheduled_at', type: 'timestamptz' })
  scheduledAt: Date;

  @Column({ type: 'enum', enum: BookingStatus, default: BookingStatus.PENDING })
  status: BookingStatus;

  // Sum of item prices before tax — kept alongside totalAmount so the order
  // summary (and any later invoice) can show a real breakdown instead of
  // recomputing it client-side from prices that may since have changed.
  // Defaulted to 0 so `synchronize: true` can add this column to a table
  // that already has rows from before it existed.
  @Column({ name: 'subtotal', type: 'numeric', precision: 10, scale: 2, default: 0 })
  subtotal: number;

  @Column({ name: 'gst_amount', type: 'numeric', precision: 10, scale: 2, default: 0 })
  gstAmount: number;

  // subtotal + gstAmount — what Razorpay actually charges (payments.service.ts).
  @Column({ name: 'total_amount', type: 'numeric', precision: 10, scale: 2 })
  totalAmount: number;

  @Column({
    name: 'payment_status',
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  paymentStatus: PaymentStatus;

  // The home-visit handshake. The agent taps "On my way" (en route + ETA),
  // which issues a 4-digit door code to the customer; at the door the
  // agent enters the code the customer reads out, proving they're at the
  // right home before any sample is drawn. The code is never selected by
  // default so it can't leak through a list or an agent's booking view —
  // only the booking's own customer is ever shown it.
  @Column({ name: 'agent_en_route_at', type: 'timestamptz', nullable: true })
  agentEnRouteAt?: Date;

  @Column({ name: 'agent_eta_at', type: 'timestamptz', nullable: true })
  agentEtaAt?: Date;

  @Column({ name: 'agent_arrived_at', type: 'timestamptz', nullable: true })
  agentArrivedAt?: Date;

  @Column({ name: 'door_otp', type: 'varchar', length: 6, nullable: true, select: false })
  doorOtp?: string | null;

  @Column({ name: 'door_otp_attempts', type: 'integer', default: 0, select: false })
  doorOtpAttempts?: number;

  // Set once the "prepare for your test" reminder has gone out, so the
  // scheduler never sends it twice.
  @Column({ name: 'prep_reminder_sent_at', type: 'timestamptz', nullable: true })
  prepReminderSentAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => BookingItem, (item) => item.booking, { cascade: true })
  items: BookingItem[];
}
