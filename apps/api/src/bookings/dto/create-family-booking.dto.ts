import { OmitType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID, ValidateNested } from 'class-validator';
import { BookingItemDto } from './booking-item.dto';
import { CreateBookingDto } from './create-booking.dto';
import { MAX_FAMILY_MEMBERS } from '../family-pricing';

export class FamilyMemberDto {
  @IsUUID()
  patientId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BookingItemDto)
  items: BookingItemDto[];
}

// One visit (center, collection mode, slot) for several family members,
// each with their own tests. Coupons and wallet aren't combined with the
// family deal.
export class CreateFamilyBookingDto extends OmitType(CreateBookingDto, ['patientId', 'items', 'couponCode', 'useWallet'] as const) {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_FAMILY_MEMBERS)
  @ValidateNested({ each: true })
  @Type(() => FamilyMemberDto)
  members: FamilyMemberDto[];
}
