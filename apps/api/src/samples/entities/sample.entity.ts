import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { SampleStatus } from '../../common/enums/sample-status.enum';
import { Booking } from '../../bookings/entities/booking.entity';
import { BookingItem } from '../../bookings/entities/booking-item.entity';
import { PartnerLab } from '../../partner-labs/entities/partner-lab.entity';
import { SampleStatusHistory } from './sample-status-history.entity';

@Entity('samples')
export class Sample {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'booking_id' })
  bookingId: string;

  @ManyToOne(() => Booking, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'booking_id' })
  booking: Booking;

  @Column({ name: 'booking_item_id' })
  bookingItemId: string;

  @ManyToOne(() => BookingItem)
  @JoinColumn({ name: 'booking_item_id' })
  bookingItem: BookingItem;

  @Column({ name: 'collected_by', nullable: true })
  collectedBy?: string;

  @Column({ type: 'enum', enum: SampleStatus, default: SampleStatus.BOOKED })
  status: SampleStatus;

  @Column({ name: 'collected_at', type: 'timestamptz', nullable: true })
  collectedAt?: Date;

  // Performance tracking for the agent who did the collection — set once,
  // at the BOOKED -> COLLECTED transition (see SamplesService.updateStatus).
  // Nullable throughout: a sample that hasn't been collected yet has
  // nothing to report, and a sample collected before this feature existed
  // has no record of it either.
  @Column({ name: 'on_time_collection', type: 'boolean', nullable: true })
  onTimeCollection?: boolean;

  @Column({ name: 'safety_id_verified', type: 'boolean', nullable: true })
  safetyIdVerified?: boolean;

  @Column({ name: 'safety_ppe_used', type: 'boolean', nullable: true })
  safetyPpeUsed?: boolean;

  @Column({ name: 'safety_hygiene_followed', type: 'boolean', nullable: true })
  safetyHygieneFollowed?: boolean;

  // The tube/label reference the agent scans or types at collection — a
  // handheld barcode scanner types into whatever field has focus (it's a
  // keyboard-emulating device, not something that needs its own driver or
  // camera integration), so a plain text field is the real-world way this
  // gets captured, not just a stand-in for a future camera-scan feature.
  @Column({ name: 'sample_barcode', length: 100, nullable: true })
  sampleBarcode?: string;

  @Column({ name: 'routed_to_partner_lab_id', nullable: true })
  routedToPartnerLabId?: string;

  @ManyToOne(() => PartnerLab, { nullable: true })
  @JoinColumn({ name: 'routed_to_partner_lab_id' })
  routedToPartnerLab?: PartnerLab;

  @Column({ name: 'expected_result_at', type: 'timestamptz', nullable: true })
  expectedResultAt?: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => SampleStatusHistory, (history) => history.sample)
  statusHistory: SampleStatusHistory[];
}
