import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

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
}
