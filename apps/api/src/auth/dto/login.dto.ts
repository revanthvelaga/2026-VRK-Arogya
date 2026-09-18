import { IsString, Matches } from 'class-validator';

export class LoginDto {
  @Matches(/^[0-9]{10}$/, { message: 'phone must be a 10-digit number' })
  phone: string;

  @IsString()
  password: string;
}
