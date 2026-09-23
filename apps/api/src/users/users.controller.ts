import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffDto } from './dto/update-staff.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

// Staff/agent roster management — admin-only. There's no self-service
// sign-up path for a STAFF account (the public /auth/register route always
// forces Role.CUSTOMER); an admin creates one here instead.
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('staff')
  listStaff() {
    return this.usersService.listStaff();
  }

  @Post('staff')
  createStaff(@Body() dto: CreateStaffDto) {
    return this.usersService.createStaffAccount(dto);
  }

  // Profile, upcoming assignments, and the on-time/safety performance
  // record built up from every collection attributed to this agent.
  @Get('staff/:id')
  getAgentDetail(@Param('id') id: string) {
    return this.usersService.getAgentDetail(id);
  }

  @Patch('staff/:id')
  updateStaff(@Param('id') id: string, @Body() dto: UpdateStaffDto) {
    return this.usersService.updateStaffAccount(id, dto);
  }
}
