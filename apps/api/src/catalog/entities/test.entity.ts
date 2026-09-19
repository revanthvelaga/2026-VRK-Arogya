import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PartnerLab } from '../../partner-labs/entities/partner-lab.entity';
import { Audience } from '../../common/enums/audience.enum';

@Entity('tests')
export class Test {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'center_id', nullable: true })
  centerId?: string;

  @Column({ length: 150 })
  name: string;

  @Column({ length: 50, nullable: true })
  code?: string;

  @Column({ name: 'sample_type', length: 50, nullable: true })
  sampleType?: string;

  // What the test checks for — shown on the catalog/test detail page.
  @Column({ type: 'text', nullable: true })
  description?: string;

  // "Things to do before the test" — fasting requirements, medication
  // pauses, etc. Shown to the customer at booking time.
  @Column({ name: 'preparation_instructions', type: 'text', nullable: true })
  preparationInstructions?: string;

  // What the report will contain / how to read it — shown alongside the
  // downloaded report, not just at booking time.
  @Column({ name: 'report_info', type: 'text', nullable: true })
  reportInfo?: string;

  // Normal reference range for this test's result value — drives the
  // automatic red-flagging of out-of-range report values (see
  // ReportValue). Left null for tests with no single numeric range
  // (e.g. imaging, qualitative results).
  @Column({ name: 'normal_range_low', type: 'numeric', precision: 10, scale: 2, nullable: true })
  normalRangeLow?: number;

  @Column({ name: 'normal_range_high', type: 'numeric', precision: 10, scale: 2, nullable: true })
  normalRangeHigh?: number;

  @Column({ name: 'normal_range_unit', length: 30, nullable: true })
  normalRangeUnit?: string;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  price: number;

  @Column({ name: 'is_in_house', default: true })
  isInHouse: boolean;

  // Set when isInHouse = false.
  @Column({ name: 'partner_lab_id', nullable: true })
  partnerLabId?: string;

  @ManyToOne(() => PartnerLab, { nullable: true })
  @JoinColumn({ name: 'partner_lab_id' })
  partnerLab?: PartnerLab;

  @Column({ name: 'turnaround_hours', default: 24 })
  turnaroundHours: number;

  // Drives the customer site's "shop by category" suggestions — most
  // tests are EVERYONE (no particular audience), not every test needs
  // tagging to a segment.
  @Column({ type: 'enum', enum: Audience, default: Audience.EVERYONE })
  audience: Audience;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
