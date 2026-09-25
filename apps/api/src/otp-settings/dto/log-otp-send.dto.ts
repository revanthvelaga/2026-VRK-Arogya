import { IsIn, IsString } from 'class-validator';

export class LogOtpSendDto {
  @IsString()
  phone: string;

  @IsIn(['login', 'register', 'reset'])
  purpose: 'login' | 'register' | 'reset';
}
