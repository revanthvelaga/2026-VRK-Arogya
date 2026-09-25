import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { OtpSettingsService } from './otp-settings.service';
import { LogOtpSendDto } from './dto/log-otp-send.dto';
import { SetOtpEnabledDto } from './dto/set-otp-enabled.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@Controller('otp')
export class OtpSettingsController {
  constructor(private readonly otpSettings: OtpSettingsService) {}

  // Public — the sign-in page checks this before ever calling Firebase,
  // so turning the switch off below actually stops real SMS from being
  // sent, not just hides a button.
  @Get('status')
  async status() {
    return { enabled: await this.otpSettings.isEnabled() };
  }

  // Public, best-effort — called by the frontend right after Firebase
  // confirms an SMS was actually sent. A failed or spoofed call here
  // costs nothing (it never touches Firebase), so no auth is needed.
  @Post('log')
  async log(@Body() dto: LogOtpSendDto) {
    await this.otpSettings.logSend(dto.phone, dto.purpose);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('admin/stats')
  getStats() {
    return this.otpSettings.getStats();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Patch('admin/enabled')
  async setEnabled(@Body() dto: SetOtpEnabledDto) {
    await this.otpSettings.setEnabled(dto.enabled);
    return { ok: true };
  }
}
