import { IsString, MaxLength } from 'class-validator';

export class UploadCertificateDto {
  @IsString()
  @MaxLength(150)
  title: string;
}
