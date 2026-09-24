import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// Family access: the account owner (say, a parent in Vizag) lets a
// caregiver (their son abroad) see and manage every patient profile on
// their account — bookings, reports, Insights, reminders — and receive a
// copy of their notifications. Starts PENDING until the caregiver accepts.
@Entity('care_links')
@Index(['ownerId', 'caregiverId'], { unique: true })
export class CareLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'owner_id' })
  ownerId: string;

  @Column({ name: 'caregiver_id' })
  caregiverId: string;

  @Column({ type: 'varchar', length: 10, default: 'PENDING' })
  status: 'PENDING' | 'ACTIVE';

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt?: Date | null;
}
