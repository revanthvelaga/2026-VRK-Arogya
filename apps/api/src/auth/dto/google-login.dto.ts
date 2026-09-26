import { IsIn, IsOptional, IsString } from 'class-validator';

export class GoogleLoginDto {
  @IsString()
  idToken: string;

  // A friend's referral code, if they signed up through one — only
  // applied when this Google sign-in creates a brand-new account.
  @IsOptional()
  @IsString()
  referralCode?: string;

  // Set by the staff console: sign in only to an existing ADMIN or STAFF
  // account of that role — never creates an account.
  @IsOptional()
  @IsIn(['ADMIN', 'STAFF'])
  portal?: 'ADMIN' | 'STAFF';
}
