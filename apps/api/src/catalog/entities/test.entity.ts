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
