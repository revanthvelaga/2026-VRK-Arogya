import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// What agents did in the field, for admins to see in the console's bell.
// One row per admin so each admin has their own read state.
@Entity('staff_alerts')
@Index(['userId', 'createdAt'])
export class StaffAlert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // The admin who receives it.
  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'agent_id' })
  agentId: string;

  // ON_THE_WAY, ARRIVED, SAMPLE_UPDATE, LEAVE_REQUEST, CERTIFICATE
  @Column({ length: 40 })
  kind: string;

  @Column()
  message: string;

  // Where in the admin console tapping the alert should go.
  @Column({ nullable: true })
  link?: string;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
