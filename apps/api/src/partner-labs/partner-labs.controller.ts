import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { PartnerLabsService } from './partner-labs.service';
import { CreatePartnerLabDto } from './dto/create-partner-lab.dto';
import { UpdatePartnerLabDto } from './dto/update-partner-lab.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

// Internal operational data (who samples get routed to), not customer
// catalog — unlike tests/packages, nothing here is public.
@Controller('partner-labs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.STAFF)
export class PartnerLabsController {
  constructor(private readonly partnerLabsService: PartnerLabsService) {}

  @Get()
  findAll() {
    return this.partnerLabsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.partnerLabsService.findOne(id);
  }

  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreatePartnerLabDto) {
    return this.partnerLabsService.create(dto);
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePartnerLabDto) {
    return this.partnerLabsService.update(id, dto);
  }
}
