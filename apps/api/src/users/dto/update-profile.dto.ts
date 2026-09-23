import { IsDateString, IsEmail, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

// Any authenticated role (customer, staff, admin) updates their own
// profile through this — the qualification/institution/graduationYear
// fields are only ever meaningful for a STAFF account, but there's no
// harm in a customer's update simply never setting them.
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  // A STAFF account is created with phone + password only (no email
  // collected up front), so this is the only place one ever gets set for
  // an agent — and it's one of the fields completion-percentage counts,
  // so leaving it out of this DTO would make 100% unreachable for them.
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  gender?: string;

  @IsOptional()
  @IsString()
  addressLine?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  pincode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  qualification?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  institution?: string;

  @IsOptional()
  @IsInt()
  @Min(1950)
  @Max(2100)
  graduationYear?: number;
}
