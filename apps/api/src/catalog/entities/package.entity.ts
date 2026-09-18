import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { Test } from './test.entity';

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
