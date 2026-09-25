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
import { PrescriptionsService } from './prescriptions.service';
import { prescriptionMulterOptions } from './prescription.multer-options';
import { TestFinderDto } from './dto/test-finder.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import { AuthenticatedUser } from '../common/types/authenticated-user';

// Signed-in only: each call is a metered AI request, so these aren't open
// to anonymous traffic.
@Controller()
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly prescriptionsService: PrescriptionsService) {}

  @Post('prescriptions')
  @UseInterceptors(FileInterceptor('file', prescriptionMulterOptions))
  upload(@CurrentUser() user: AuthenticatedUser, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('file is required');
    return this.prescriptionsService.readPrescription(user.userId, file);
  }

  @Get('prescriptions/mine')
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.prescriptionsService.findMine(user.userId);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Get('prescriptions')
  findAll() {
    return this.prescriptionsService.findAllForAdmin();
  }

  @Get('prescriptions/:id/file')
  async file(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<StreamableFile> {
    const p = await this.prescriptionsService.getFile(id, user);
    return new StreamableFile(p.fileData, { type: p.mimeType, disposition: `inline; filename="${p.fileName}"` });
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Patch('prescriptions/:id/reviewed')
  markReviewed(@Param('id') id: string) {
    return this.prescriptionsService.markReviewed(id);
  }

  @Post('test-finder')
  findTests(@Body() dto: TestFinderDto) {
    return this.prescriptionsService.findTests(dto);
  }
}
