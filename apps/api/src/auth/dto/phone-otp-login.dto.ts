import { IsIn, IsOptional, IsString } from 'class-validator';

export class PhoneOtpLoginDto {
  @IsString()
  idToken: string;

  // Only required the first time this phone number signs in — the
  // service rejects a brand-new phone with no name rather than creating
  // an account called "undefined".
  @IsOptional()
  @IsString()
  fullName?: string;

  // A friend's referral code, if they signed up through one — only
  // applied when this sign-in creates a brand-new account.
  @IsOptional()
  @IsString()
  referralCode?: string;

  // Set by the staff console: sign in only to an existing ADMIN or STAFF
  // account of that role — never creates an account.
  @IsOptional()
  @IsIn(['ADMIN', 'STAFF'])
  portal?: 'ADMIN' | 'STAFF';
}
