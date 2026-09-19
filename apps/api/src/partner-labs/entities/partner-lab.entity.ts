import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('partner_labs')
export class PartnerLab {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 150 })
  name: string;

  @Column({ length: 100, nullable: true })
  city?: string;

  @Column({ name: 'contact_phone', length: 15, nullable: true })
  contactPhone?: string;

  @Column({ name: 'default_turnaround_hours', default: 24 })
  defaultTurnaroundHours: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
