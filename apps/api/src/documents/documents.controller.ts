import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentsService } from './documents.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { documentMulterOptions } from './documents.multer-options';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';

// "My documents" on the customer's account page: insurance cards,
// Aadhaar, prescriptions and the like, visible only to the uploader.
@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get('mine')
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.documentsService.findMine(user.userId);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file', documentMulterOptions))
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UploadDocumentDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Choose a file to upload');
    return this.documentsService.upload(user.userId, dto, file);
  }

  @Get(':id/download')
  async download(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('view') view?: string,
  ): Promise<StreamableFile> {
    const doc = await this.documentsService.getForDownload(id, user.userId);
    return new StreamableFile(doc.fileData, {
      type: doc.mimeType,
      disposition: `${view ? 'inline' : 'attachment'}; filename="${doc.fileName}"`,
    });
  }

  @Delete(':id')
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.documentsService.remove(id, user.userId);
    return { deleted: true };
  }
}
