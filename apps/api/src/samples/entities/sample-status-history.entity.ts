import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { SampleStatus } from '../../common/enums/sample-status.enum';
import { Sample } from './sample.entity';

@Entity('sample_status_history')
export class SampleStatusHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'sample_id' })
  sampleId: string;

  @ManyToOne(() => Sample, (sample) => sample.statusHistory, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sample_id' })
  sample: Sample;

  @Column({ type: 'enum', enum: SampleStatus })
  status: SampleStatus;

  @Column({ name: 'changed_by', nullable: true })
  changedBy?: string;

  @CreateDateColumn({ name: 'changed_at' })
  changedAt: Date;

  @Column({ type: 'text', nullable: true })
  notes?: string;
}
