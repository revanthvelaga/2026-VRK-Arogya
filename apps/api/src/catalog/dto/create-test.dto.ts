import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateTestDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  sampleType?: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsBoolean()
  isInHouse?: boolean;

  @IsOptional()
  @IsUUID()
  partnerLabId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  turnaroundHours?: number;

  @IsOptional()
  @IsUUID()
  centerId?: string;
}
