import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { IsIn } from 'class-validator';
import { ReportSharesService } from './report-shares.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';

class CreateShareDto {
  @IsIn([1, 7, 30])
  days: number;
}

@Controller()
export class ReportSharesController {
  constructor(private readonly sharesService: ReportSharesService) {}

  @UseGuards(JwtAuthGuard)
  @Post('reports/:id/shares')
  create(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: CreateShareDto) {
    return this.sharesService.create(id, dto.days, user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('reports/:id/shares')
  list(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.sharesService.listActive(id, user);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('report-shares/:id')
  revoke(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.sharesService.revoke(id, user);
  }

  // Public on purpose — this is the link a doctor opens. The token is the
  // credential: 24 random bytes, expiring, revocable.
  @Get('shared-reports/:token')
  view(@Param('token') token: string) {
    return this.sharesService.viewShared(token);
  }

  @Get('shared-reports/:token/file')
  async file(@Param('token') token: string): Promise<StreamableFile> {
    const report = await this.sharesService.sharedFile(token);
    return new StreamableFile(report.fileData, {
      type: report.mimeType,
      disposition: `inline; filename="${report.fileName}"`,
    });
  }
}
