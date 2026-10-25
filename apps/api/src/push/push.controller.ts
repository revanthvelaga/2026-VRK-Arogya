import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { PushService } from './push.service';
import { RegisterDeviceDto, UnregisterDeviceDto } from './dto/register-device.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';

@Controller('devices')
export class PushController {
  constructor(private readonly push: PushService) {}

  // The signed-in app gives us its FCM token so this account's updates
  // can reach this phone.
  @UseGuards(JwtAuthGuard)
  @Post()
  async register(@CurrentUser() user: AuthenticatedUser, @Body() dto: RegisterDeviceDto) {
    await this.push.register(user.userId, dto.token, dto.platform);
    return { ok: true };
  }

  // Called on sign-out. No login needed — by then the session is already
  // ending — because only the phone itself knows its token, and all this
  // does is stop sending to it.
  @Post('unregister')
  @HttpCode(200)
  async unregister(@Body() dto: UnregisterDeviceDto) {
    await this.push.unregister(dto.token);
    return { ok: true };
  }
}
