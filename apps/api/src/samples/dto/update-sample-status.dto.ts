import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { SampleStatus } from '../../common/enums/sample-status.enum';

export class UpdateSampleStatusDto {
  @IsEnum(SampleStatus)
  status: SampleStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
