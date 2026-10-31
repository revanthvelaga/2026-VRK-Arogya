import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// A passkey a customer saved on one of their devices (fingerprint, face or
// screen-lock sign-in). Only the public key is kept here; the private key
// never leaves the phone. One account can have several (phone + laptop).
@Entity('passkeys')
export class Passkey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  // The authenticator's credential id, base64url — what the browser sends
  // back on sign-in to say which passkey it used.
  @Index({ unique: true })
  @Column({ name: 'credential_id', length: 512 })
  credentialId: string;

  // COSE public key, base64url.
  @Column({ name: 'public_key', type: 'text' })
  publicKey: string;

  // Signature counter, to spot a cloned authenticator (most synced
  // passkeys always report 0, which is fine).
  @Column({ type: 'bigint', default: 0 })
  counter: string;

  @Column({ type: 'simple-array', nullable: true })
  transports: string[] | null;

  // A label the customer sees in their profile, e.g. "Android phone".
  @Column({ name: 'device_name', length: 80, default: 'This device' })
  deviceName: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt: Date | null;
}
