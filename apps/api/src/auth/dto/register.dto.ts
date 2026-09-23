import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { Role } from '../../common/enums/role.enum';
import { normalizeIndianPhone } from '../../common/utils/phone.util';

export class RegisterDto {
  @IsString()
  fullName: string;

  @Transform(({ value }) => normalizeIndianPhone(value))
  @Matches(/^[0-9]{10}$/, { message: 'phone must be a 10-digit number' })
  phone: string;

  @IsOptional()
  @IsString()
  email?: string;

  @MinLength(6)
  password: string;

  // Only used when an admin creates a STAFF/ADMIN account;
  // public self-signup should always be forced to CUSTOMER in the service layer.
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
