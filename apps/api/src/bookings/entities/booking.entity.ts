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

  @Column({ name: 'total_amount', type: 'numeric', precision: 10, scale: 2 })
  totalAmount: number;

  @Column({
    name: 'payment_status',
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  paymentStatus: PaymentStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => BookingItem, (item) => item.booking, { cascade: true })
  items: BookingItem[];
}
