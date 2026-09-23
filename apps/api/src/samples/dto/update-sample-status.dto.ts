import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { SampleStatus } from '../../common/enums/sample-status.enum';

export class UpdateSampleStatusDto {
  @IsEnum(SampleStatus)
  status: SampleStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  // Only meaningful (and only read) when status is COLLECTED — the safety
  // checklist the collecting agent confirms at the point of collection.
  // Left unset, each defaults to false rather than "unknown" so a skipped
  // checklist shows up honestly in an agent's performance record instead
  // of silently counting as compliant.
  @IsOptional()
  @IsBoolean()
  idVerified?: boolean;

  @IsOptional()
  @IsBoolean()
  ppeUsed?: boolean;

  @IsOptional()
  @IsBoolean()
  hygieneFollowed?: boolean;

  // The tube/label reference — typed or scanned (a handheld scanner just
  // types into this field) — only recorded when status is COLLECTED.
  @IsOptional()
  @IsString()
  @MaxLength(100)
  barcode?: string;

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
