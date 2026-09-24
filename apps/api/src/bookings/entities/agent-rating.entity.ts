import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// A customer's rating of the agent who collected their sample — one per
// booking (re-rating updates it). Feeds the agent's performance view in
// the admin console alongside on-time and safety numbers.
@Entity('agent_ratings')
export class AgentRating {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ name: 'booking_id' })
  bookingId: string;

  @Index()
  @Column({ name: 'agent_id' })
  agentId: string;

  @Column({ name: 'customer_id' })
  customerId: string;

  @Column({ type: 'smallint' })
  rating: number;

  @Column({ type: 'text', nullable: true })
  comment?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
