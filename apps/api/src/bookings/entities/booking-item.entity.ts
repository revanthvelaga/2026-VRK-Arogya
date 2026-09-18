import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Booking } from './booking.entity';

@Entity('booking_items')
export class BookingItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'booking_id' })
  bookingId: string;

  @ManyToOne(() => Booking, (booking) => booking.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'booking_id' })
  booking: Booking;

  @Column({ name: 'test_id', nullable: true })
  testId?: string;

  @Column({ name: 'package_id', nullable: true })
  packageId?: string;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  price: number;
}
