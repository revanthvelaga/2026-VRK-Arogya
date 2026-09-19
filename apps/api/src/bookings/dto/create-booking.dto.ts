import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CollectionMode } from '../../common/enums/collection-mode.enum';
import { BookingItemDto } from './booking-item.dto';

export class CreateBookingDto {
  @IsUUID()
  patientId: string;

  @IsUUID()
  centerId: string;

  @IsEnum(CollectionMode)
  collectionMode: CollectionMode;

  // Required when collectionMode is PICKUP_POINT, disallowed otherwise —
  // enforced in BookingsService.
  @IsOptional()
  @IsUUID()
  pickupPointId?: string;

  // The following four are required together when collectionMode is
  // HOME_VISIT, disallowed otherwise — enforced in BookingsService, which
  // also rejects an address outside the center's serviceRadiusKm.
  @IsOptional()
  @IsString()
  homeAddressLine?: string;

  @IsOptional()
  @IsString()
  homeAddressPincode?: string;

  @IsOptional()
  @IsLatitude()
  homeLatitude?: number;

  @IsOptional()
  @IsLongitude()
  homeLongitude?: number;

  @IsDateString()
  scheduledAt: string;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => BookingItemDto)
  items: BookingItemDto[];
}
