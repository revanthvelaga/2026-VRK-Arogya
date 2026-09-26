import { Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { StaffAlertsService } from './staff-alerts.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { Role } from '../common/enums/role.enum';

@Controller('staff-alerts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class StaffAlertsController {
  constructor(private readonly staffAlerts: StaffAlertsService) {}

  @Get('mine')
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.staffAlerts.findMine(user.userId);
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.staffAlerts.markAllRead(user.userId);
  }
}
