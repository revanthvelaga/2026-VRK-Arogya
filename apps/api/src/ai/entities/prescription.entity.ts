import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export interface PrescriptionMatch {
  writtenAs: string;
  kind: 'test' | 'package' | null;
  catalogId: string | null;
  name: string | null;
  price: number | null;
  confidence: 'high' | 'medium' | 'low';
}

// A doctor's prescription a customer uploaded so we could work out which
// tests to book. The file is kept (bytea, same reasoning as reports: no
// local disk to lose on the host) so the lab can look at the original if
// the automatic reading missed something, and call the customer back.
@Entity('prescriptions')
export class Prescription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'customer_id' })
  customerId: string;

  @Column({ name: 'file_data', type: 'bytea' })
  fileData: Buffer;

  @Column({ name: 'file_name' })
  fileName: string;

  @Column({ name: 'mime_type' })
  mimeType: string;

  @Column({ name: 'size_bytes', type: 'integer' })
  sizeBytes: number;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  matches: PrescriptionMatch[];

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ name: 'doctor_name', length: 150, nullable: true })
  doctorName?: string;

  // NEW until the lab has looked at it; admin marks it REVIEWED.
  @Column({ length: 20, default: 'NEW' })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
