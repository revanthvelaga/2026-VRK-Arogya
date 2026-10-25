import { Body, Controller, Headers, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { PhoneOtpLoginDto } from './dto/phone-otp-login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { OtpSendDto } from './dto/otp-send.dto';
import { OtpVerifyDto } from './dto/otp-verify.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('google')
  googleLogin(@Body() dto: GoogleLoginDto) {
    return this.authService.googleLogin(dto.idToken, dto.referralCode, dto.portal);
  }

  @Post('phone-otp')
  phoneOtpLogin(@Body() dto: PhoneOtpLoginDto) {
    return this.authService.phoneOtpLogin(dto.idToken, dto.fullName, dto.referralCode, dto.portal);
  }

  // WhatsApp OTP: send the code, then check it and get a short-lived
  // proof of the number to use with phone-otp / reset-password below.
  @Post('otp/send')
  sendOtp(@Body() dto: OtpSendDto, @Req() req: Request, @Headers('x-forwarded-for') forwarded?: string) {
    const ip = (forwarded?.split(',')[0] ?? req.ip ?? 'unknown').trim();
    return this.authService.sendWhatsAppOtp(dto.phone, dto.purpose, dto.portal, ip);
  }

  @Post('otp/verify')
  verifyOtp(@Body() dto: OtpVerifyDto) {
    return this.authService.verifyWhatsAppOtp(dto.phone, dto.otp);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPasswordWithPhone(dto.idToken, dto.newPassword);
  }
}
