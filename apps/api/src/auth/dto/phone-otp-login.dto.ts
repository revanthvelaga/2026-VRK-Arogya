import { IsOptional, IsString } from 'class-validator';

export class PhoneOtpLoginDto {
  @IsString()
  idToken: string;

  // Only required the first time this phone number signs in — the
  // service rejects a brand-new phone with no name rather than creating
  // an account called "undefined".
  @IsOptional()
  @IsString()
  fullName?: string;
}
