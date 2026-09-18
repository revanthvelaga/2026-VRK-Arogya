import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('pickup_point_schedules')
export class PickupPointSchedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'pickup_point_id' })
  pickupPointId: string;

  @Column({ name: 'day_of_week', type: 'smallint' })
  dayOfWeek: number; // 0=Sunday ... 6=Saturday

  @Column({ name: 'start_time', type: 'time' })
  startTime: string;

  @Column({ name: 'end_time', type: 'time' })
  endTime: string;
}
