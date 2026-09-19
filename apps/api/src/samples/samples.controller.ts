import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { SamplesService } from './samples.service';
import { UpdateSampleStatusDto } from './dto/update-sample-status.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import { AuthenticatedUser } from '../common/types/authenticated-user';

// No single '/samples' resource root — a sample only ever makes sense in
// the context of the booking it came from, so routes hang off '/bookings'
// for creation/listing and off '/samples/:id' for updates to one sample.
@Controller()
@UseGuards(JwtAuthGuard)
export class SamplesController {
  constructor(private readonly samplesService: SamplesService) {}

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.STAFF)
  @Post('bookings/:bookingId/samples')
  initialize(@Param('bookingId') bookingId: string) {
    return this.samplesService.initializeForBooking(bookingId);
  }

  @Get('bookings/:bookingId/samples')
  findForBooking(
    @CurrentUser() user: AuthenticatedUser,
    @Param('bookingId') bookingId: string,
  ) {
    return this.samplesService.findForBooking(bookingId, user);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.STAFF)
  @Patch('samples/:id/status')
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateSampleStatusDto,
  ) {
    return this.samplesService.updateStatus(id, user.userId, dto);
  }

  @Get('samples/:id/history')
  history(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.samplesService.getHistory(id, user);
  }
}
