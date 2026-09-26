import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum DocumentCategory {
  INSURANCE = 'INSURANCE',
  AADHAAR = 'AADHAAR',
  PAN = 'PAN',
  PRESCRIPTION = 'PRESCRIPTION',
  MEDICAL = 'MEDICAL',
  OTHER = 'OTHER',
}

// A customer's own important papers (insurance card, Aadhaar, old
// prescriptions…). Same bytea-in-Postgres pattern as Report.fileData —
// the host's disk doesn't survive a restart. The bytes are only ever
// read back by the account that uploaded them.
@Entity('customer_documents')
export class CustomerDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'account_id' })
  accountId: string;

  // Whose document it is (self or a family member); null = the account holder.
  @Column({ name: 'patient_id', type: 'uuid', nullable: true })
  patientId: string | null;

  @Column({ type: 'varchar', length: 20 })
  category: DocumentCategory;

  @Column({ length: 120 })
  title: string;

  // select: false — lists never pull the file bytes, only download does.
  @Column({ name: 'file_data', type: 'bytea', select: false })
  fileData: Buffer;

  @Column({ name: 'file_name' })
  fileName: string;

  @Column({ name: 'mime_type' })
  mimeType: string;

  @Column({ name: 'size_bytes', type: 'integer' })
  sizeBytes: number;

  // True while the AI is still working out category/title/person in the
  // background (see DocumentsService.sortInBackground).
  @Column({ name: 'sort_pending', default: false })
  sortPending: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
