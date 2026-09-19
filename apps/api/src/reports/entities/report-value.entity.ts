import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Report } from './report.entity';

// One row per test result inside a report — staff enter these when a
// report is uploaded (or afterwards). isAbnormal is computed once at
// write time against the Test's normal range and stored, so reads never
// have to recompute it and a test whose range later changes doesn't
// retroactively reclassify old reports.
@Entity('report_values')
export class ReportValue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'report_id' })
  reportId: string;

  @ManyToOne(() => Report, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'report_id' })
  report: Report;

  @Column({ name: 'test_id', nullable: true })
  testId?: string;

  // Denormalized so a value still displays sensibly if the Test it came
  // from is later renamed or deleted.
  @Column({ name: 'test_name', length: 150 })
  testName: string;

  @Column({ type: 'numeric', precision: 12, scale: 3 })
  value: number;

  @Column({ length: 30, nullable: true })
  unit?: string;

  @Column({ name: 'normal_low', type: 'numeric', precision: 10, scale: 2, nullable: true })
  normalLow?: number;

  @Column({ name: 'normal_high', type: 'numeric', precision: 10, scale: 2, nullable: true })
  normalHigh?: number;

  @Column({ name: 'is_abnormal', default: false })
  isAbnormal: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
