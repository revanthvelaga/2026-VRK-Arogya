import { IsBoolean, IsNumber, IsOptional, IsString, Min, MaxLength } from 'class-validator';

export class UpdateStaffDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  // Empty string clears it — UsersService.updateStaffAccount treats '' the
  // same as unset.
  @IsOptional()
  @IsString()
  @MaxLength(150)
  specialization?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // Admin-only — never exposed on UpdateProfileDto, which an agent uses to
  // edit their own profile.
  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlySalary?: number;
}
