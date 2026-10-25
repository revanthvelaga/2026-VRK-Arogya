import { Matches } from 'class-validator';

export class OtpVerifyDto {
  @Matches(/^\d{10}$/, { message: 'Enter a valid 10-digit mobile number.' })
  phone: string;

  @Matches(/^\d{4,8}$/, { message: 'Enter the code from the SMS.' })
  otp: string;
}
