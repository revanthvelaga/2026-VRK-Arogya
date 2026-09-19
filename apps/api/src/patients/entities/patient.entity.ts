import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';
import { Relationship } from '../../common/enums/relationship.enum';
import { Gender } from '../../common/enums/gender.enum';

// A patient profile under a customer account — the account holder always
// gets one with relationship SELF, auto-created at registration (see
// AuthService.register); additional rows are family members added later.
// Bookings are made for a Patient, not directly for the account, so one
// login can track separate results/reports per family member.
@Entity('patients')
export class Patient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'account_id' })
  accountId: string;

  @Column({ name: 'full_name', length: 150 })
  fullName: string;

  @Column({ type: 'enum', enum: Relationship, default: Relationship.SELF })
  relationship: Relationship;

  @Column({ type: 'enum', enum: Gender, nullable: true })
  gender?: Gender;

  @Column({ name: 'date_of_birth', type: 'date', nullable: true })
  dateOfBirth?: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
