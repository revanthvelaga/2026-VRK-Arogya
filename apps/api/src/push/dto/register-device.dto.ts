import { IsIn, IsString, Length } from 'class-validator';

export class RegisterDeviceDto {
  @IsString()
  @Length(20, 4096)
  token: string;

  @IsIn(['android'])
  platform: 'android';
}

export class UnregisterDeviceDto {
  @IsString()
  @Length(20, 4096)
  token: string;
}
