import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

// A passkey (WebAuthn credential) — the phone's fingerprint / Face ID or
// screen lock stands in for an OTP or password. We keep only the public
// key; the private key never leaves the customer's device.
@Entity('passkeys')
export class Passkey {
  // The credential ID the authenticator created (base64url).
  @PrimaryColumn({ length: 512 })
  id: string;

  @Index()
  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'public_key', type: 'bytea' })
  publicKey: Buffer;

  @Column({ type: 'bigint', default: 0 })
  counter: string;

  @Column({ type: 'simple-array', nullable: true })
  transports?: string[] | null;

  @Column({ name: 'device_name', length: 80 })
  deviceName: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt?: Date | null;
}
