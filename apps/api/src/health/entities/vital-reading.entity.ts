import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export const VITAL_TYPES = ['BP', 'SUGAR_FASTING', 'SUGAR_RANDOM', 'WEIGHT', 'PULSE'] as const;
export type VitalType = (typeof VITAL_TYPES)[number];

// A reading the patient took at home — BP from a cuff, sugar from a
// glucometer, weight from a scale. Sits alongside lab results on
// Insights so the numbers between lab visits aren't lost.
@Entity('vital_readings')
export class VitalReading {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'patient_id' })
  patientId: string;

  @Column({ name: 'recorded_by' })
  recordedBy: string;

  @Column({ type: 'varchar', length: 20 })
  type: VitalType;

  // Systolic for BP; the single value for everything else.
  @Column({ type: 'numeric', precision: 7, scale: 2 })
  value: number;

  // Diastolic for BP only.
  @Column({ name: 'value2', type: 'numeric', precision: 7, scale: 2, nullable: true })
  value2?: number | null;

  @Column({ name: 'recorded_at', type: 'timestamptz' })
  recordedAt: Date;

  @Column({ type: 'varchar', length: 200, nullable: true })
  note?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
