import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { ResetStaffPasswordDto } from './dto/reset-staff-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UploadCertificateDto } from './dto/upload-certificate.dto';
import { RequestLeaveDto } from './dto/request-leave.dto';
import { ReviewLeaveDto } from './dto/review-leave.dto';
import { certificateMulterOptions } from './certificates.multer-options';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import { LeaveStatus } from '../common/enums/leave-status.enum';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { StaffAlertsService } from '../staff-alerts/staff-alerts.service';

// Two distinct audiences share this controller:
//  - /users/me/* — any authenticated role, always about the caller's own
//    account (profile, certificates, leave requests). No @Roles() here on
//    purpose — RolesGuard treats an undecorated route as open to anyone
//    signed in.
//  - /users/staff/* and /users/leaves/*/status — admin-only roster
//    management (create/view/edit an agent, approve/reject leave).
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly staffAlerts: StaffAlertsService,
  ) {}

  // ---- Self-service profile (any role) ----

  @Get('me')
  getOwnProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getProfile(user.userId);
  }

  @Patch('me')
  updateOwnProfile(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.userId, dto);
  }

  @Post('me/certificates')
  @UseInterceptors(FileInterceptor('file', certificateMulterOptions))
  async uploadCertificate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UploadCertificateDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('file is required');
    const cert = await this.usersService.uploadCertificate(user.userId, user.role, dto.title, file);
    this.staffAlerts.record(user, 'CERTIFICATE', (agent) => `${agent} uploaded a certificate: ${dto.title}.`, `/staff/${user.userId}`);
    return cert;
  }

  @Get('me/certificates')
  listOwnCertificates(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.listCertificates(user.userId);
  }

  @Get('certificates/:id/download')
  async downloadCertificate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<StreamableFile> {
    const cert = await this.usersService.getCertificateForDownload(id, user);
    return new StreamableFile(cert.fileData, {
      type: cert.mimeType,
      disposition: `attachment; filename="${cert.fileName}"`,
    });
  }

  @Post('me/leaves')
  async requestLeave(@CurrentUser() user: AuthenticatedUser, @Body() dto: RequestLeaveDto) {
    const leave = await this.usersService.requestLeave(user.userId, user.role, dto);
    const day = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const days = dto.startDate === dto.endDate ? day(dto.startDate) : `${day(dto.startDate)} to ${day(dto.endDate)}`;
    this.staffAlerts.record(user, 'LEAVE_REQUEST', (agent) => `${agent} asked for leave: ${days}. Tap to approve or reject.`, '/leaves');
    return leave;
  }

  @Get('me/leaves')
  listOwnLeaves(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.listOwnLeaves(user.userId);
  }

  // ---- Admin-only staff roster management ----

  @Roles(Role.ADMIN)
  @Get('staff')
  listStaff() {
    return this.usersService.listStaff();
  }

  @Roles(Role.ADMIN)
  @Post('staff')
  createStaff(@Body() dto: CreateStaffDto) {
    return this.usersService.createStaffAccount(dto);
  }

  // Every leave request across every agent, for the roster-wide leave/
  // calendar page. Registered before 'staff/:id' so 'leaves' is never
  // read as an id.
  @Roles(Role.ADMIN)
  @Get('staff/leaves')
  listAllLeaves() {
    return this.usersService.listAllLeaves();
  }

  // Profile, address, academic details, certificates, salary, leave
  // record, upcoming assignments, and the on-time/safety performance
  // record built up from every collection attributed to this agent.
  @Roles(Role.ADMIN)
  @Get('staff/:id')
  getAgentDetail(@Param('id') id: string) {
    return this.usersService.getAgentDetail(id);
  }

  @Roles(Role.ADMIN)
  @Patch('staff/:id')
  updateStaff(@Param('id') id: string, @Body() dto: UpdateStaffDto) {
    return this.usersService.updateStaffAccount(id, dto);
  }

  // An agent who's forgotten their password — the admin sets a new one
  // and tells them, no SMS needed.
  @Roles(Role.ADMIN)
  @Patch('staff/:id/password')
  resetStaffPassword(@Param('id') id: string, @Body() dto: ResetStaffPasswordDto) {
    return this.usersService.resetStaffPassword(id, dto.password);
  }

  @Roles(Role.ADMIN)
  @Patch('leaves/:id/status')
  reviewLeave(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: ReviewLeaveDto) {
    return this.usersService.reviewLeave(id, user.userId, dto.status as LeaveStatus.APPROVED | LeaveStatus.REJECTED);
  }
}
