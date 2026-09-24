import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// A time-limited link to one report that the patient can hand to a doctor
// (as a link or a QR code) — no login needed to open it, so the token is
// long and random, it expires, and the patient can revoke it any time.
@Entity('report_shares')
export class ReportShare {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ length: 64 })
  token: string;

  @Index()
  @Column({ name: 'report_id' })
  reportId: string;

  @Column({ name: 'created_by' })
  createdBy: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt?: Date | null;

  @Column({ name: 'view_count', type: 'int', default: 0 })
  viewCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
