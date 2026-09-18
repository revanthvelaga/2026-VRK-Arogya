import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';
import { GeoPoint } from '../../common/types/geo-point';

@Entity('diagnostic_centers')
export class DiagnosticCenter {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 150 })
  name: string;

  @Column({ type: 'text', nullable: true })
  address?: string;

  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
  })
  location: GeoPoint;

  @Column({
    name: 'service_radius_km',
    type: 'numeric',
    precision: 5,
    scale: 2,
    default: 20,
  })
  serviceRadiusKm: number;

  @Column({ name: 'owner_id', nullable: true })
  ownerId?: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
