import { IsEnum, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { SampleStatus } from '../../common/enums/sample-status.enum';

export class UpdateSampleStatusDto {
  @IsEnum(SampleStatus)
  status: SampleStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  // Required when status is ROUTED_TO_PARTNER_LAB — which lab it's going to.
  @IsOptional()
  @IsUUID()
  partnerLabId?: string;

  // Overrides the SLA target (partner lab's default, or none for in-house)
  // with a turnaround time specific to this sample.
  @IsOptional()
  @IsInt()
  @Min(1)
  turnaroundHoursOverride?: number;
}
