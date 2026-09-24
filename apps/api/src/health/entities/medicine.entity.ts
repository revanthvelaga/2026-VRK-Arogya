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

  // Free text: "Once daily after breakfast", "Twice a day".
  @Column({ type: 'varchar', length: 120, nullable: true })
  schedule?: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
