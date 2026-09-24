import { IsBoolean, IsDateString, IsIn, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { VITAL_TYPES } from '../entities/vital-reading.entity';

export class CreateVitalDto {
  @IsUUID()
  patientId: string;

  @IsIn(VITAL_TYPES)
  type: (typeof VITAL_TYPES)[number];

  @IsNumber()
  @Min(0)
  value: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  value2?: number;

  @IsOptional()
  @IsDateString()
  recordedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}

export class CreateGoalDto {
  @IsUUID()
  patientId: string;

  @IsString()
  @MaxLength(80)
  metric: string;

  @IsString()
  @MaxLength(100)
  label: string;

  @IsIn(['BELOW', 'ABOVE'])
  direction: 'BELOW' | 'ABOVE';

  @IsNumber()
  target: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;
}

export class CreateMedicineDto {
  @IsUUID()
  patientId: string;

  @IsString()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  dosage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  schedule?: string;
}

export class UpdateMedicineDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  dosage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  schedule?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
