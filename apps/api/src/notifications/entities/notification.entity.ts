import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { NotificationType } from '../../common/enums/notification-type.enum';

// The one channel that always works, with zero external dependency — every
// notification is written here first, whatever else happens with it.
@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  @Column()
  message: string;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt?: Date;

  @Column({ name: 'email_sent', default: false })
  emailSent: boolean;

  // Ethereal's preview link in dev (see EmailChannelService) — lets you
  // actually open and read the email that was sent, without a real inbox.
  @Column({ name: 'email_preview_url', nullable: true })
  emailPreviewUrl?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
