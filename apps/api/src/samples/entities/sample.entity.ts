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

  // Plain id, not a relation — the PartnerLab entity doesn't exist yet
  // (that's step 7, partner-lab routing).
  @Column({ name: 'routed_to_partner_lab_id', nullable: true })
  routedToPartnerLabId?: string;

  @Column({ name: 'expected_result_at', type: 'timestamptz', nullable: true })
  expectedResultAt?: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => SampleStatusHistory, (history) => history.sample)
  statusHistory: SampleStatusHistory[];
}
