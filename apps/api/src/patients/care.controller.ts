import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsString, IsUUID, Matches } from 'class-validator';
import { CareService } from './care.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../common/enums/notification-type.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';

class InviteCaregiverDto {
  @IsString()
  @Matches(/^(\+?91)?\d{10}$/, { message: 'Enter a 10-digit mobile number' })
  phone: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Choose at least one person to share' })
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  patientIds: string[];
}

class UpdateSharedPatientsDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Choose at least one person to share' })
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  patientIds: string[];
}

@Controller('care')
@UseGuards(JwtAuthGuard)
export class CareController {
  constructor(
    private readonly careService: CareService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.careService.list(user.userId);
  }

  @Post('invite')
  async invite(@CurrentUser() user: AuthenticatedUser, @Body() dto: InviteCaregiverDto) {
    const { caregiverId } = await this.careService.invite(user.userId, dto.phone.replace(/\s/g, ''), dto.patientIds);
    const ownerName = await this.careService.nameOf(user.userId);
    await this.notificationsService.notify(
      caregiverId,
      NotificationType.CARE_INVITE,
      `${ownerName} invited you to look after their family's health on Arogya. Accept from your profile.`,
    );
    return this.careService.list(user.userId);
  }

  @Patch(':id/patients')
  async updatePatients(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateSharedPatientsDto) {
    await this.careService.updatePatients(id, user.userId, dto.patientIds);
    return this.careService.list(user.userId);
  }

  @Post(':id/accept')
  async accept(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.careService.accept(id, user.userId);
    return this.careService.list(user.userId);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.careService.remove(id, user.userId);
    return this.careService.list(user.userId);
  }
}
