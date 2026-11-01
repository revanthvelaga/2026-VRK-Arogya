import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// What the patient currently takes — useful context when reading results
// (and for the collection agent: "on blood thinners").
@Entity('medicines')
export class Medicine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'patient_id' })
  patientId: string;

  @Column({ length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  dosage?: string | null;

  // The brand / company on the strip, e.g. "Glycomet" or "Cipla".
  @Column({ type: 'varchar', length: 80, nullable: true })
  brand?: string | null;

  // When it's taken: any of MORNING, AFTERNOON, EVENING, NIGHT.
  @Column({ type: 'simple-array', nullable: true })
  timings?: string[] | null;

  // BEFORE or AFTER food, when it matters.
  @Column({ type: 'varchar', length: 10, nullable: true })
  food?: string | null;

  // Free text: "Once daily after breakfast", "Twice a day".
  @Column({ type: 'varchar', length: 120, nullable: true })
  schedule?: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
