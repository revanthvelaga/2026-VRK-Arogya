import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// Family access: the account owner (say, a parent in Vizag) lets a
// caregiver (their son abroad) see and manage the patient profiles they
// choose — bookings, reports, Insights, reminders — and receive a copy of
// the notifications about those people. Starts PENDING until accepted.
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

  // Which of the owner's patients are shared. null = all of them (links
  // made before sharing could be chosen per person).
  @Column({ name: 'patient_ids', type: 'uuid', array: true, nullable: true })
  patientIds: string[] | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt?: Date | null;
}
