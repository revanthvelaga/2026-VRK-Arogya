import { IsInt, Matches, Max, Min } from 'class-validator';

export class CreateScheduleDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number; // 0=Sunday ... 6=Saturday

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'startTime must be in HH:mm 24-hour format',
  })
  startTime: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'endTime must be in HH:mm 24-hour format',
  })
  endTime: string;
}
