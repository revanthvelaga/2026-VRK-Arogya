import { IsIn, IsOptional, Matches } from 'class-validator';

export class OtpSendDto {
  @Matches(/^\d{10}$/, { message: 'Enter a valid 10-digit mobile number.' })
  phone: string;

  @IsIn(['login', 'register', 'reset'])
  purpose: 'login' | 'register' | 'reset';

  // Staff console: only text a number that already has an account of this
  // role, so nobody can use the admin page to send SMS to strangers.
  @IsOptional()
  @IsIn(['ADMIN', 'STAFF'])
  portal?: 'ADMIN' | 'STAFF';
}
