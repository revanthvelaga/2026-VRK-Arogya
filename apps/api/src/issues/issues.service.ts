import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Issue } from './entities/issue.entity';
import { IssueComment } from './entities/issue-comment.entity';
import { AddIssueCommentDto } from './dto/add-issue-comment.dto';
import { Role } from '../common/enums/role.enum';
import { CreateIssueDto } from './dto/create-issue.dto';
import { UpdateIssueStatusDto } from './dto/update-issue-status.dto';
import { BookingsService } from '../bookings/bookings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../common/enums/notification-type.enum';
import { IssueStatus } from '../common/enums/issue-status.enum';
import { AuthenticatedUser } from '../common/types/authenticated-user';

@Injectable()
export class IssuesService {
  constructor(
    @InjectRepository(Issue)
    private readonly issuesRepo: Repository<Issue>,
    @InjectRepository(IssueComment)
    private readonly commentsRepo: Repository<IssueComment>,
    private readonly dataSource: DataSource,
    private readonly bookingsService: BookingsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(bookingId: string, user: AuthenticatedUser, dto: CreateIssueDto): Promise<Issue> {
    // Anyone raising an issue must actually own the booking (or be staff) —
    // same ownership check every other booking-scoped resource reuses.
    await this.bookingsService.findOneForUser(bookingId, user);
    return this.issuesRepo.save(
      this.issuesRepo.create({
        bookingId,
        raisedBy: user.userId,
        subject: dto.subject,
        description: dto.description,
        status: IssueStatus.OPEN,
      }),
    );
  }

  async findForBooking(bookingId: string, user: AuthenticatedUser): Promise<Issue[]> {
    await this.bookingsService.findOneForUser(bookingId, user);
    return this.issuesRepo.find({ where: { bookingId }, order: { createdAt: 'DESC' } });
  }

  // Each ticket with how many replies support has sent and when the last
  // message was, so the list can say "Support replied".
  async findMine(userId: string) {
    const issues = await this.issuesRepo.find({ where: { raisedBy: userId }, order: { createdAt: 'DESC' } });
    if (!issues.length) return [];
    const comments = await this.commentsRepo.find({ where: { issueId: In(issues.map((i) => i.id)) } });
    return issues.map((i) => {
      const mine = comments.filter((c) => c.issueId === i.id);
      const last = mine.reduce<IssueComment | null>((a, c) => (!a || c.createdAt > a.createdAt ? c : a), null);
      return {
        ...i,
        staffReplies: mine.filter((c) => c.fromStaff).length,
        lastMessageAt: last?.createdAt ?? null,
        lastFromStaff: last?.fromStaff ?? false,
      };
    });
  }

  private isStaff(user: AuthenticatedUser) {
    return user.role === Role.ADMIN || user.role === Role.STAFF;
  }

  // The person who raised it, anyone on the customer side of its booking,
  // or staff.
  private async issueFor(id: string, user: AuthenticatedUser): Promise<Issue> {
    const issue = await this.issuesRepo.findOne({ where: { id } });
    if (!issue) throw new NotFoundException('Ticket not found');
    if (!this.isStaff(user) && issue.raisedBy !== user.userId) {
      await this.bookingsService.findOneForUser(issue.bookingId, user).catch(() => {
        throw new ForbiddenException('Not your ticket');
      });
    }
    return issue;
  }

  async findOneWithThread(id: string, user: AuthenticatedUser) {
    const issue = await this.issueFor(id, user);
    const comments = await this.commentsRepo.find({ where: { issueId: id }, order: { createdAt: 'ASC' } });
    const ids = [...new Set([issue.raisedBy, ...comments.map((c) => c.authorId)])];
    const rows = (await this.dataSource.query(`SELECT id::text AS id, full_name FROM users WHERE id::text = ANY($1)`, [
      ids,
    ])) as Array<{ id: string; full_name: string }>;
    const name = new Map(rows.map((r) => [r.id, r.full_name]));
    return {
      ...issue,
      raisedByName: name.get(issue.raisedBy) ?? 'Customer',
      comments: comments.map((c) => ({
        id: c.id,
        message: c.message,
        fromStaff: c.fromStaff,
        // Customers see "Arogya support", not which staff member.
        authorName: c.fromStaff ? (this.isStaff(user) ? (name.get(c.authorId) ?? 'Staff') : 'Arogya support') : (name.get(c.authorId) ?? 'Customer'),
        createdAt: c.createdAt,
      })),
    };
  }

  async addComment(id: string, user: AuthenticatedUser, dto: AddIssueCommentDto) {
    const issue = await this.issueFor(id, user);
    const fromStaff = this.isStaff(user);
    await this.commentsRepo.save(
      this.commentsRepo.create({ issueId: id, authorId: user.userId, fromStaff, message: dto.message.trim() }),
    );
    if (fromStaff) {
      // A reply means someone is on it.
      if (issue.status === IssueStatus.OPEN) {
        issue.status = IssueStatus.IN_PROGRESS;
        await this.issuesRepo.save(issue);
      }
      const preview = dto.message.trim().slice(0, 120);
      await this.notificationsService.notify(
        issue.raisedBy,
        NotificationType.ISSUE_UPDATED,
        `Arogya support replied to "${issue.subject}": ${preview}${dto.message.trim().length > 120 ? '…' : ''}`,
      );
    } else if (issue.status === IssueStatus.RESOLVED) {
      // The customer writing back on a closed ticket reopens it.
      await this.issuesRepo.update(id, { status: IssueStatus.OPEN, resolvedAt: () => 'NULL', resolvedBy: () => 'NULL' });
    }
    return this.findOneWithThread(id, user);
  }

  findAll(): Promise<Issue[]> {
    return this.issuesRepo.find({ order: { createdAt: 'DESC' } });
  }

  async updateStatus(id: string, resolvedBy: string, dto: UpdateIssueStatusDto): Promise<Issue> {
    const issue = await this.issuesRepo.findOne({ where: { id } });
    if (!issue) throw new NotFoundException('Issue not found');

    issue.status = dto.status;
    if (dto.status === IssueStatus.RESOLVED) {
      issue.resolvedBy = resolvedBy;
      issue.resolvedAt = new Date();
    }
    const saved = await this.issuesRepo.save(issue);

    await this.notificationsService.notify(
      issue.raisedBy,
      NotificationType.ISSUE_UPDATED,
      `Your issue "${issue.subject}" is now ${dto.status.replace('_', ' ').toLowerCase()}.`,
    );

    return saved;
  }
}
