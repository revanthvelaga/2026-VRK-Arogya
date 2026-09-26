import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// One message in a ticket's conversation — from the customer or from the
// lab's staff. The customer's opening description stays on the Issue
// itself; these are everything after it.
@Entity('issue_comments')
export class IssueComment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'issue_id' })
  issueId: string;

  @Column({ name: 'author_id' })
  authorId: string;

  @Column({ name: 'from_staff', default: false })
  fromStaff: boolean;

  @Column({ type: 'text' })
  message: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
