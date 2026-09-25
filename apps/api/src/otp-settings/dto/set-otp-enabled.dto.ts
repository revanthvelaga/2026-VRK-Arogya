import { IsBoolean } from 'class-validator';

export class SetOtpEnabledDto {
  @IsBoolean()
  enabled: boolean;
}
