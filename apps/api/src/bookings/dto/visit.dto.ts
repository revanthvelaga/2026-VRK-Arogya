import { IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export class EnRouteDto {
  @IsInt()
  @Min(1)
  @Max(240)
  etaMinutes: number;
}

export class VerifyDoorOtpDto {
  @IsString()
  @Matches(/^\d{4}$/, { message: 'Enter the 4-digit code' })
  otp: string;
}

export class RateAgentDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
