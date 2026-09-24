import { Controller, Get, Query } from '@nestjs/common';
import { HolidaysService } from './holidays.service';

// Public, non-sensitive calendar data (India's public holidays) — no
// auth guard, same as GeocodeController.
@Controller('holidays')
export class HolidaysController {
  constructor(private readonly holidaysService: HolidaysService) {}

  @Get()
  list(@Query('year') year?: string) {
    const parsed = year ? parseInt(year, 10) : undefined;
    return this.holidaysService.listHolidays(parsed && !Number.isNaN(parsed) ? parsed : undefined);
  }
}
