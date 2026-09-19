import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { IssuesService } from './issues.service';
import { CreateIssueDto } from './dto/create-issue.dto';
import { UpdateIssueStatusDto } from './dto/update-issue-status.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import { AuthenticatedUser } from '../common/types/authenticated-user';

// Same shape as ReportsController/SamplesController: an issue only makes
// sense in the context of the booking it's about, so raise/list hang off
// '/bookings/:bookingId/issues'; the admin-wide list and status update are
// their own '/issues' resource.
@Controller()
@UseGuards(JwtAuthGuard)
export class IssuesController {
  constructor(private readonly issuesService: IssuesService) {}

  @Post('bookings/:bookingId/issues')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('bookingId') bookingId: string,
    @Body() dto: CreateIssueDto,
  ) {
    return this.issuesService.create(bookingId, user, dto);
  }

  @Get('bookings/:bookingId/issues')
  findForBooking(@CurrentUser() user: AuthenticatedUser, @Param('bookingId') bookingId: string) {
    return this.issuesService.findForBooking(bookingId, user);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.STAFF)
  @Get('issues')
  findAll() {
    return this.issuesService.findAll();
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.STAFF)
  @Patch('issues/:id/status')
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateIssueStatusDto,
  ) {
    return this.issuesService.updateStatus(id, user.userId, dto);
  }
}
