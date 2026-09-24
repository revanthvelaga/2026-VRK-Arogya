import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { Test } from './test.entity';
import { Audience } from '../../common/enums/audience.enum';

@Entity('packages')
export class Package {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'center_id', nullable: true })
  centerId?: string;

  @Column({ length: 150 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'enum', enum: Audience, default: Audience.EVERYONE })
  audience: Audience;

  // BASIC / STANDARD / PREMIUM — how full-body checkups are presented as
  // a ladder (Japan's "ningen dock" style), so a customer can compare
  // levels instead of reading one long list of packages. Null for
  // packages that aren't part of the ladder.
  @Column({ type: 'varchar', length: 20, nullable: true })
  tier?: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToMany(() => Test)
  @JoinTable({
    name: 'package_tests',
    joinColumn: { name: 'package_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'test_id', referencedColumnName: 'id' },
  })
  tests: Test[];
}
