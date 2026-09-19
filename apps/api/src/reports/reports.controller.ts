import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as fs from 'fs';
import type { File } from 'multer';
import { ReportsService } from './reports.service';
import { reportMulterOptions } from './reports.multer-options';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '../common/enums/role.enum';
import { AuthenticatedUser } from '../common/types/authenticated-user';

// Same pattern as SamplesController: a report only makes sense in the
// context of the booking it belongs to, so upload/list hang off
// '/bookings/:bookingId/reports'; download is its own '/reports/:id'
// resource since a client fetches one specific file by its own id.
@Controller()
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.STAFF)
  @Post('bookings/:bookingId/reports')
  @UseInterceptors(FileInterceptor('file', reportMulterOptions))
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @Param('bookingId') bookingId: string,
    @UploadedFile() file?: File,
  ) {
    if (!file) throw new BadRequestException('file is required');
    return this.reportsService.upload(bookingId, user.userId, file);
  }

  @Get('bookings/:bookingId/reports')
  findForBooking(@CurrentUser() user: AuthenticatedUser, @Param('bookingId') bookingId: string) {
    return this.reportsService.findForBooking(bookingId, user);
  }

  @Get('reports/:id/download')
  async download(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<StreamableFile> {
    const report = await this.reportsService.getForDownload(id, user);
    return new StreamableFile(fs.createReadStream(report.fileUrl), {
      type: report.mimeType,
      disposition: `attachment; filename="${report.fileName}"`,
    });
  }
}
