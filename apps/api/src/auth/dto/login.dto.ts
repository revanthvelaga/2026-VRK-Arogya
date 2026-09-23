import { Transform } from 'class-transformer';
import { IsString, Matches } from 'class-validator';
import { normalizeIndianPhone } from '../../common/utils/phone.util';

export class LoginDto {
  @Transform(({ value }) => normalizeIndianPhone(value))
  @Matches(/^[0-9]{10}$/, { message: 'phone must be a 10-digit number' })
  phone: string;

  @IsString()
  password: string;
}
