import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class RequestLeaveDto {
  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsString()
  @MaxLength(50)
  leaveType: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
