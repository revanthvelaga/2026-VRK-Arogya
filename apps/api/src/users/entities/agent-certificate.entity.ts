import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../user.entity';

// An academic/training certificate an agent (STAFF) uploads as part of
// their mandatory profile completion. Same bytea-in-Postgres pattern as
// Report.fileData and SampleImage.imageData — no local-disk storage on a
// host whose filesystem doesn't survive a restart.
@Entity('agent_certificates')
export class AgentCertificate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  // What the agent says this certificate is — "B.Sc Nursing", "Phlebotomy
  // certification", etc. Free text, same reasoning as User.specialization.
  @Column({ length: 150 })
  title: string;

  @Column({ name: 'file_data', type: 'bytea' })
  fileData: Buffer;

  @Column({ name: 'file_name' })
  fileName: string;

  @Column({ name: 'mime_type' })
  mimeType: string;

  @Column({ name: 'size_bytes', type: 'integer' })
  sizeBytes: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
