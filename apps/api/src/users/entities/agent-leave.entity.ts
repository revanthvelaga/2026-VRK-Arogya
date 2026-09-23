import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { LeaveStatus } from '../../common/enums/leave-status.enum';
import { User } from '../user.entity';

// A leave request an agent raises from their own portal; an admin
// approves or rejects it. Kept simple on purpose — a date range, a free-
// text type ("Sick", "Casual", ...), and a reason — rather than an
// accrual/balance system this app has no other use for.
@Entity('agent_leaves')
export class AgentLeave {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate: string;

  @Column({ name: 'leave_type', length: 50 })
  leaveType: string;

  @Column({ type: 'text', nullable: true })
  reason?: string;

  @Column({ type: 'enum', enum: LeaveStatus, default: LeaveStatus.PENDING })
  status: LeaveStatus;

  @Column({ name: 'reviewed_by', nullable: true })
  reviewedBy?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
