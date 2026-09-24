import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// Records that a "time to retest" reminder went out for one patient's
// test result, so the same result never triggers a second reminder.
@Entity('retest_reminders')
@Index(['patientId', 'testId', 'lastTestedAt'], { unique: true })
export class RetestReminder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'patient_id' })
  patientId: string;

  @Column({ name: 'test_id' })
  testId: string;

  @Column({ name: 'last_tested_at', type: 'timestamptz' })
  lastTestedAt: Date;

  @CreateDateColumn({ name: 'sent_at' })
  sentAt: Date;
}
