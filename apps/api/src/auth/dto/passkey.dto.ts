import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server';

export class PasskeyRegisterVerifyDto {
  @IsString()
  challengeToken: string;

  // The browser's WebAuthn result, passed through as-is.
  @IsObject()
  response: RegistrationResponseJSON;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  deviceName?: string;
}

export class PasskeyLoginVerifyDto {
  @IsString()
  challengeToken: string;

  @IsObject()
  response: AuthenticationResponseJSON;
}
