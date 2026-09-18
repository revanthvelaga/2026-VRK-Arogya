import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';
import { GeoPoint } from '../../common/types/geo-point';

@Entity('pickup_points')
export class PickupPoint {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'center_id' })
  centerId: string;

  @Column({ length: 150 })
  name: string;

  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
  })
  location: GeoPoint;

  @Column({ name: 'village_name', length: 150, nullable: true })
  villageName?: string;

  // Cached distance from the owning center, recomputed whenever the
  // pickup point's location is set.
  @Column({
    name: 'distance_km',
    type: 'numeric',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  distanceKm?: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
