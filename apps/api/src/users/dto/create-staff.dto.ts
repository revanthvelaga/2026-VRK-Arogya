import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { normalizeIndianPhone } from '../../common/utils/phone.util';

export class CreateStaffDto {
  @IsString()
  fullName: string;

  @Transform(({ value }) => normalizeIndianPhone(value))
  @Matches(/^[0-9]{10}$/, { message: 'phone must be a 10-digit number' })
  phone: string;

  @MinLength(6)
  password: string;

  // e.g. "Phlebotomy", "Home collection" — free text, see User.specialization.
  @IsOptional()
  @IsString()
  @MaxLength(150)
  specialization?: string;
}
