import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Sample } from './sample.entity';

export type SampleImageKind = 'COLLECTION' | 'DROP_OFF';

// Proof photos an agent captures in the field — a collection photo (the
// sample tube/label, taken at pickup) and/or a drop-off photo (handoff at
// the center). Stored as bytea in Postgres, not on local disk, for the
// same reason as Report.fileData: a free-tier host's filesystem doesn't
// survive a restart, and this table is small/short-lived data, not a
// medical record that needs its own archival story.
@Entity('sample_images')
export class SampleImage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'sample_id' })
  sampleId: string;

  @ManyToOne(() => Sample, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sample_id' })
  sample: Sample;

  @Column({ type: 'varchar', length: 20 })
  kind: SampleImageKind;

  @Column({ name: 'image_data', type: 'bytea' })
  imageData: Buffer;

  @Column({ name: 'mime_type' })
  mimeType: string;

  @Column({ name: 'size_bytes', type: 'integer' })
  sizeBytes: number;

  @Column({ name: 'uploaded_by' })
  uploadedBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
