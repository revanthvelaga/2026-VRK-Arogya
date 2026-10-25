import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

// A sign-in code that was sent and not yet used. Only a keyed hash of the
// code is stored (never the code), one row per phone number: asking for a
// new code replaces the old one. Rows are deleted when the code is used.
@Entity('otp_challenges')
export class OtpChallenge {
  @PrimaryColumn({ length: 15 })
  phone: string;

  @Column({ name: 'code_hash', length: 64 })
  codeHash: string;

  // Wrong guesses against this code; at the limit it is dead.
  @Column({ default: 0 })
  attempts: number;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
