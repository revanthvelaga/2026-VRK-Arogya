import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

// One row per real SMS Firebase actually sent (the frontend logs this
// right after Firebase confirms the send, not before) — a cheap
// approximation of "how many messages have we been billed for" without
// pulling in Google Cloud's billing API. Best-effort telemetry, not an
// authoritative invoice — Firebase Console remains the source of truth
// for actual cost.
@Entity('otp_send_logs')
export class OtpSendLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  phone: string;

  // 'login' | 'register' | 'reset' — which flow triggered the send.
  @Column()
  purpose: string;

  @CreateDateColumn()
  createdAt: Date;
}
