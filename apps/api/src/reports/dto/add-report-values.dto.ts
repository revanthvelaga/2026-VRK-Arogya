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
}

export class AddReportValuesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReportValueEntryDto)
  values: ReportValueEntryDto[];
}
