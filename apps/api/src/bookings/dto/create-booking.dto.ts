import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CollectionMode } from '../../common/enums/collection-mode.enum';
import { BookingItemDto } from './booking-item.dto';

export class CreateBookingDto {
  @IsUUID()
  centerId: string;

  @IsEnum(CollectionMode)
  collectionMode: CollectionMode;

  // Required when collectionMode is PICKUP_POINT, disallowed otherwise —
  // enforced in BookingsService.
  @IsOptional()
  @IsUUID()
  pickupPointId?: string;

  @IsDateString()
  scheduledAt: string;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => BookingItemDto)
  items: BookingItemDto[];
}
