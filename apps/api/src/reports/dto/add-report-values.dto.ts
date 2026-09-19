import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNumber, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';

export class ReportValueEntryDto {
  @IsOptional()
  @IsUUID()
  testId?: string;

  @IsString()
  testName: string;

  @IsNumber()
  value: number;

  @IsOptional()
  @IsString()
  unit?: string;

  // Only needed for a free-form entry (no testId) — a testId entry always
  // inherits its Test's category, same as normalLow/normalHigh.
  @IsOptional()
  @IsString()
  category?: string;
}

export class AddReportValuesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReportValueEntryDto)
  values: ReportValueEntryDto[];
}
