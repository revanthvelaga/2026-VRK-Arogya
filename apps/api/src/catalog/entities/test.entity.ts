import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

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

  // Set when isInHouse = false; PartnerLab entity arrives with the
  // partner-lab-routing module, so this stays a plain id until then.
  @Column({ name: 'partner_lab_id', nullable: true })
  partnerLabId?: string;

  @Column({ name: 'turnaround_hours', default: 24 })
  turnaroundHours: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
