import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SamplesService } from './samples.service';
import { VisitService } from '../bookings/visit.service';
import { UpdateSampleStatusDto } from './dto/update-sample-status.dto';
import { UploadSampleImageDto } from './dto/upload-sample-image.dto';
import { sampleImageMulterOptions } from './samples.multer-options';
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
  constructor(
    private readonly samplesService: SamplesService,
    private readonly visitService: VisitService,
  ) {}

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.STAFF)
  @Post('bookings/:bookingId/samples')
  async initialize(@CurrentUser() user: AuthenticatedUser, @Param('bookingId') bookingId: string) {
    await this.visitService.assertReadyToCollect(bookingId, user);
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

  // Proof photos, captured in the field — a collection shot or a drop-off
  // shot, told apart by ?kind=. Same multipart-into-bytea pattern as
  // ReportsController's upload.
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.STAFF)
  @Post('samples/:id/images')
  @UseInterceptors(FileInterceptor('file', sampleImageMulterOptions))
  uploadImage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UploadSampleImageDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('file is required');
    return this.samplesService.uploadImage(id, dto.kind, user.userId, file);
  }

  @Get('samples/:id/images')
  listImages(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.samplesService.listImages(id, user);
  }

  @Get('sample-images/:id/download')
  async downloadImage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('view') view?: string,
  ): Promise<StreamableFile> {
    const image = await this.samplesService.getImageForDownload(id, user);
    const dispositionType = view ? 'inline' : 'attachment';
    return new StreamableFile(image.imageData, {
      type: image.mimeType,
      disposition: `${dispositionType}; filename="${id}.jpg"`,
    });
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.STAFF)
  @Get('partner-labs/:partnerLabId/sla')
  slaSummary(@Param('partnerLabId') partnerLabId: string) {
    return this.samplesService.getSlaSummaryForPartnerLab(partnerLabId);
  }
}
