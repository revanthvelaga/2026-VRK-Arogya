import { Body, Controller, Delete, Get, Headers, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { PasskeyService } from './passkey.service';
import { AuthService } from './auth.service';
import { PasskeyLoginVerifyDto, PasskeyRegisterVerifyDto } from './dto/passkey.dto';

@Controller('auth/passkey')
export class PasskeyController {
  constructor(
    private readonly passkeys: PasskeyService,
    private readonly authService: AuthService,
  ) {}

  // ---- Sign in (no session yet) ----

  @Post('login/options')
  loginOptions(@Headers('origin') origin?: string) {
    return this.passkeys.authenticationOptions(origin);
  }

  @Post('login/verify')
  async loginVerify(@Body() dto: PasskeyLoginVerifyDto) {
    const userId = await this.passkeys.verifyAuthentication(dto.challengeToken, dto.response);
    return this.authService.signInById(userId);
  }

  // ---- Save / manage passkeys (signed in) ----

  @UseGuards(JwtAuthGuard)
  @Post('register/options')
  registerOptions(@CurrentUser() user: AuthenticatedUser, @Headers('origin') origin?: string) {
    return this.passkeys.registrationOptions(user.userId, origin);
  }

  @UseGuards(JwtAuthGuard)
  @Post('register/verify')
  registerVerify(@CurrentUser() user: AuthenticatedUser, @Body() dto: PasskeyRegisterVerifyDto) {
    return this.passkeys.verifyRegistration(user.userId, dto.challengeToken, dto.response, dto.deviceName);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.passkeys.list(user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.passkeys.remove(user.userId, id);
  }
}
