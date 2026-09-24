import { Body, Controller, Delete, Get, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server';
import { PasskeysService } from './passkeys.service';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';

class RegisterPasskeyDto {
  @IsObject()
  response: RegistrationResponseJSON;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  deviceName?: string;
}

class PasskeyLoginDto {
  @IsString()
  challengeId: string;

  @IsObject()
  response: AuthenticationResponseJSON;
}

@Controller('auth/passkeys')
export class PasskeysController {
  constructor(
    private readonly passkeysService: PasskeysService,
    private readonly authService: AuthService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.passkeysService.list(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('register/options')
  registrationOptions(@CurrentUser() user: AuthenticatedUser, @Headers('origin') origin?: string) {
    return this.passkeysService.registrationOptions(user.userId, origin);
  }

  @UseGuards(JwtAuthGuard)
  @Post('register')
  register(@CurrentUser() user: AuthenticatedUser, @Body() dto: RegisterPasskeyDto) {
    return this.passkeysService.register(user.userId, dto.response, dto.deviceName);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.passkeysService.remove(user.userId, id);
  }

  @Post('login/options')
  loginOptions(@Headers('origin') origin?: string) {
    return this.passkeysService.loginOptions(origin);
  }

  @Post('login')
  async login(@Body() dto: PasskeyLoginDto) {
    const userId = await this.passkeysService.authenticate(dto.challengeId, dto.response);
    return this.authService.loginAsUser(userId);
  }
}
