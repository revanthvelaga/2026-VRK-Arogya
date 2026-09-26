import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { DocumentCategory } from '../entities/customer-document.entity';

export class UploadDocumentDto {
  @IsEnum(DocumentCategory)
  category: DocumentCategory;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title: string;

  @IsOptional()
  @IsUUID()
  patientId?: string;
}
