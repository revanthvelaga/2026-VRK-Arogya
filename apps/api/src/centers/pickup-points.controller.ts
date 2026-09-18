import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PickupPointsService } from './pickup-points.service';
import { CreatePickupPointDto } from './dto/create-pickup-point.dto';
import { UpdatePickupPointDto } from './dto/update-pickup-point.dto';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { NearbyQueryDto } from './dto/nearby-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@Controller('pickup-points')
export class PickupPointsController {
  constructor(private readonly pickupPointsService: PickupPointsService) {}

  // Registered before ':id' so it isn't swallowed by that param route.
  @Get('nearby')
  findNearby(@Query() query: NearbyQueryDto) {
    return this.pickupPointsService.findNearby(query.lat, query.lng, query.radiusKm);
  }

  @Get()
  findForCenter(@Query('centerId') centerId: string) {
    return this.pickupPointsService.findAllForCenter(centerId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.pickupPointsService.findOne(id);
  }

  @Get(':id/schedules')
  getSchedules(@Param('id') id: string) {
    return this.pickupPointsService.getSchedules(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreatePickupPointDto) {
    return this.pickupPointsService.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePickupPointDto) {
    return this.pickupPointsService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.pickupPointsService.remove(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post(':id/schedules')
  addSchedule(@Param('id') id: string, @Body() dto: CreateScheduleDto) {
    return this.pickupPointsService.addSchedule(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete('schedules/:scheduleId')
  removeSchedule(@Param('scheduleId') scheduleId: string) {
    return this.pickupPointsService.removeSchedule(scheduleId);
  }
}
