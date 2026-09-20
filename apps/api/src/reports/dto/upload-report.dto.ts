import { IsDateString, IsOptional } from 'class-validator';

export class UploadReportDto {
  // The date printed on the report itself — lets staff back-date an older
  // report at upload time instead of it defaulting to "now". Optional:
  // omitted, the report is stamped with the upload moment as before.
  @IsOptional()
  @IsDateString()
  reportDate?: string;
}
