import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
import { AssignAgentDto } from './dto/assign-agent.dto';
import { EnRouteDto, RateAgentDto, VerifyDoorOtpDto } from './dto/visit.dto';
import { VisitService } from './visit.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import { AuthenticatedUser } from '../common/types/authenticated-user';

@Controller('bookings')
@UseGuards(JwtAuthGuard)
export class BookingsController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly visitService: VisitService,
  ) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateBookingDto) {
    return this.bookingsService.create(user.userId, dto);
  }

  @Get('mine')
  findMine(@CurrentUser() user: AuthenticatedUser, @Query('patientId') patientId?: string) {
    return this.bookingsService.findAllForCustomer(user.userId, patientId);
  }

  // An agent's own collection queue. Registered before ':id' for the same
  // reason as the comment below — 'assigned' would otherwise be read as a
  // booking id.
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.STAFF)
  @Get('assigned/mine')
  findAssignedToMe(@CurrentUser() user: AuthenticatedUser) {
    return this.bookingsService.findAllForAgent(user.userId);
  }

  // Registered before ':id' so it isn't swallowed by that param route.
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.STAFF)
  @Get()
  findAll() {
    return this.bookingsService.findAll();
  }

  @Get(':id')
  async findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const booking = await this.bookingsService.findOneDetailed(id, user);
    return this.visitService.decorateForCustomer(booking, user);
  }

  @Patch(':id/cancel')
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.bookingsService.cancel(id, user);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.STAFF)
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateBookingStatusDto) {
    return this.bookingsService.updateStatus(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.STAFF)
  @Patch(':id/agent')
  assignAgent(@Param('id') id: string, @Body() dto: AssignAgentDto) {
    return this.bookingsService.assignAgent(id, dto.agentId);
  }

  // The assigned agent sets off for a home visit: records an ETA and sends
  // the customer a door code.
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.STAFF)
  @Patch(':id/en-route')
  enRoute(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: EnRouteDto) {
    return this.visitService.markEnRoute(id, dto.etaMinutes, user);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.STAFF)
  @Post(':id/verify-otp')
  verifyOtp(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: VerifyDoorOtpDto) {
    return this.visitService.verifyDoorOtp(id, dto.otp, user);
  }

  @Post(':id/rating')
  rate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: RateAgentDto) {
    return this.visitService.rateAgent(id, dto.rating, dto.comment, user);
  }
}
