import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Booking } from '../../bookings/entities/booking.entity';

// Matches schema.sql's `reports` table (id, booking_id, file_url,
// generated_at, reviewed_by), extended with the metadata a real
// upload/download flow needs (fileName, mimeType, sizeBytes, uploadedBy).
@Entity('reports')
export class Report {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'booking_id' })
  bookingId: string;

  @ManyToOne(() => Booking, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'booking_id' })
  booking: Booking;

  // Today, this is an absolute path on local disk (see
  // reports.multer-options.ts) — swap it for a real S3 URL once that
  // integration lands; nothing else about this column changes.
  @Column({ name: 'file_url' })
  fileUrl: string;

  @Column({ name: 'file_name' })
  fileName: string;

  @Column({ name: 'mime_type' })
  mimeType: string;

  // 'integer', not 'bigint' — the 10MB upload limit (reports.multer-options.ts)
  // is well within int32 range, and TypeORM maps bigint columns to string
  // (since JS numbers can't safely hold every bigint value), which would
  // otherwise make this field's type awkward for no real benefit here.
  @Column({ name: 'size_bytes', type: 'integer' })
  sizeBytes: number;

  @Column({ name: 'uploaded_by' })
  uploadedBy: string;

  // The date the report was actually generated (as printed on the lab's
  // own PDF), not necessarily the moment it was uploaded into Arogya —
  // staff can back-date this at upload time when entering an older
  // report. Defaults to "now" (a plain Column with a DB default, not
  // @CreateDateColumn, precisely so it stays overridable).
  @Column({ name: 'generated_at', type: 'timestamptz', default: () => 'now()' })
  generatedAt: Date;

  @Column({ name: 'reviewed_by', nullable: true })
  reviewedBy?: string;
}
