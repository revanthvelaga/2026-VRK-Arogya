import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// "Get HbA1c below 6.5", "Weight below 75 kg". The metric is either a
// home vital type (WEIGHT, BP, SUGAR_FASTING…) or a lab test
// ("test:<testId>"); progress is always measured against the latest
// reading of that metric, so a goal never needs updating by hand.
@Entity('health_goals')
export class HealthGoal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'patient_id' })
  patientId: string;

  @Column({ length: 80 })
  metric: string;

  @Column({ length: 100 })
  label: string;

  @Column({ type: 'varchar', length: 10 })
  direction: 'BELOW' | 'ABOVE';

  @Column({ type: 'numeric', precision: 8, scale: 2 })
  target: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  unit?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
