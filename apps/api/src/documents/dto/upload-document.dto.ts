import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { DocumentCategory } from '../entities/customer-document.entity';

// Everything is optional: whatever isn't given is worked out from the
// file itself (see DocumentsService.classify).
export class UploadDocumentDto {
  @IsOptional()
  @IsEnum(DocumentCategory)
  category?: DocumentCategory;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsUUID()
  patientId?: string;
}
