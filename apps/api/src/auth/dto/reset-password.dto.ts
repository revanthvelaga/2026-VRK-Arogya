import { IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  // A Firebase phone-auth ID token — same proof of phone ownership the
  // OTP sign-in endpoint trusts, reused here to authorize the reset.
  @IsString()
  idToken: string;

  @MinLength(6)
  newPassword: string;
}
