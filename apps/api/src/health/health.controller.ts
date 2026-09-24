import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { HealthService } from './health.service';
import { CreateGoalDto, CreateMedicineDto, CreateVitalDto, UpdateMedicineDto } from './dto/health.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';

// Per-patient home health tracking. Every route checks the patient
// belongs to the signed-in account.
@Controller('health')
@UseGuards(JwtAuthGuard)
export class HealthTrackingController {
  constructor(private readonly healthService: HealthService) {}

  @Get('vitals')
  vitals(@CurrentUser() user: AuthenticatedUser, @Query('patientId') patientId: string) {
    return this.healthService.listVitals(patientId, user.userId);
  }

  @Post('vitals')
  addVital(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateVitalDto) {
    return this.healthService.addVital(dto, user.userId);
  }

  @Delete('vitals/:id')
  deleteVital(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.healthService.deleteVital(id, user.userId);
  }

  @Get('goals')
  goals(@CurrentUser() user: AuthenticatedUser, @Query('patientId') patientId: string) {
    return this.healthService.listGoals(patientId, user.userId);
  }

  @Post('goals')
  addGoal(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateGoalDto) {
    return this.healthService.addGoal(dto, user.userId);
  }

  @Delete('goals/:id')
  deleteGoal(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.healthService.deleteGoal(id, user.userId);
  }

  @Get('medicines')
  medicines(@CurrentUser() user: AuthenticatedUser, @Query('patientId') patientId: string) {
    return this.healthService.listMedicines(patientId, user.userId);
  }

  @Post('medicines')
  addMedicine(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateMedicineDto) {
    return this.healthService.addMedicine(dto, user.userId);
  }

  @Patch('medicines/:id')
  updateMedicine(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateMedicineDto) {
    return this.healthService.updateMedicine(id, dto, user.userId);
  }

  @Delete('medicines/:id')
  deleteMedicine(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.healthService.deleteMedicine(id, user.userId);
  }

  @Get('retests')
  retests(@CurrentUser() user: AuthenticatedUser, @Query('patientId') patientId: string) {
    return this.healthService.listRetests(patientId, user.userId);
  }
}
