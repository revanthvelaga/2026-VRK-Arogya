import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreatePartnerLabDto {
  @IsString()
  @MaxLength(150)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(15)
  contactPhone?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  defaultTurnaroundHours?: number;
}
