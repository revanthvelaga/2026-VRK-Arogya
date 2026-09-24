import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ReportsService } from './reports.service';
import { reportMulterOptions } from './reports.multer-options';
import { AddReportValuesDto } from './dto/add-report-values.dto';
import { UploadReportDto } from './dto/upload-report.dto';
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
    @Body() dto: UploadReportDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('file is required');
    return this.reportsService.upload(bookingId, user.userId, file, dto.reportDate);
  }

  @Get('bookings/:bookingId/reports')
  findForBooking(@CurrentUser() user: AuthenticatedUser, @Param('bookingId') bookingId: string) {
    return this.reportsService.findForBooking(bookingId, user);
  }

  // Registered before 'reports/:id/download' so 'mine' isn't swallowed as an :id.
  @Get('reports/mine/values')
  findMineValues(@CurrentUser() user: AuthenticatedUser, @Query('patientId') patientId?: string) {
    return this.reportsService.findAllValuesForCustomer(user.userId, patientId);
  }

  @Get('reports/mine/recommendation')
  getRecommendation(@CurrentUser() user: AuthenticatedUser, @Query('patientId') patientId?: string) {
    return this.reportsService.getHealthRecommendation(user.userId, patientId);
  }

  // `?view=1` renders the PDF in the browser tab (Content-Disposition:
  // inline) instead of forcing a save-to-disk prompt — the same bytes,
  // same endpoint, same auth check either way.
  @Get('reports/:id/download')
  async download(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('view') view?: string,
  ): Promise<StreamableFile> {
    const report = await this.reportsService.getForDownload(id, user);
    const dispositionType = view ? 'inline' : 'attachment';
    return new StreamableFile(report.fileData, {
      type: report.mimeType,
      disposition: `${dispositionType}; filename="${report.fileName}"`,
    });
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.STAFF)
  @Post('reports/:id/values')
  addValues(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AddReportValuesDto,
  ) {
    return this.reportsService.addValues(id, user, dto);
  }

  @Get('reports/:id/values')
  findValues(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.reportsService.findValues(id, user);
  }

  @Post('report-values/:id/explain')
  explain(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.reportsService.explainValue(id, user);
  }
}
