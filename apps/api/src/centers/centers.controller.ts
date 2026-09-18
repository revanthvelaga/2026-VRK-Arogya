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
import { CentersService } from './centers.service';
import { CreateCenterDto } from './dto/create-center.dto';
import { UpdateCenterDto } from './dto/update-center.dto';
import { NearbyQueryDto } from './dto/nearby-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@Controller('centers')
export class CentersController {
  constructor(private readonly centersService: CentersService) {}

  @Get()
  findAll() {
    return this.centersService.findAllActive();
  }

  // Registered before ':id' so it isn't swallowed by that param route.
  @Get('nearby')
  findNearby(@Query() query: NearbyQueryDto) {
    return this.centersService.findNearby(query.lat, query.lng);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.centersService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreateCenterDto) {
    return this.centersService.create(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCenterDto) {
    return this.centersService.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.centersService.remove(id);
  }
}
