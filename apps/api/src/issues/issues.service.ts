import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Issue } from './entities/issue.entity';
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

  findMine(userId: string): Promise<Issue[]> {
    return this.issuesRepo.find({ where: { raisedBy: userId }, order: { createdAt: 'DESC' } });
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
