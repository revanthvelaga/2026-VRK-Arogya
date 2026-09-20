import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';
import { Relationship } from '../../common/enums/relationship.enum';
import { Gender } from '../../common/enums/gender.enum';
import { GeoPoint } from '../../common/types/geo-point';

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

  // Contact/address details, collected when the patient is added via the
  // booking flow's "Who is this for?" form — area comes from the address
  // autocomplete, which also fills location + pincode; fullAddress and
  // landmark are free text the customer types themselves.
  @Column({ name: 'area_address', type: 'text', nullable: true })
  areaAddress?: string;

  @Column({ length: 10, nullable: true })
  pincode?: string;

  @Column({ name: 'full_address', type: 'text', nullable: true })
  fullAddress?: string;

  @Column({ nullable: true })
  landmark?: string;

  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  location?: GeoPoint;

  @Column({ length: 15, nullable: true })
  phone?: string;

  @Column({ name: 'alternate_phone', length: 15, nullable: true })
  alternatePhone?: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
