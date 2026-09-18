import { IsOptional, IsUUID } from 'class-validator';

// Exactly one of testId/packageId is enforced in BookingsService, not here —
// class-validator's conditional decorators get unreadable fast for XOR rules.
export class BookingItemDto {
  @IsOptional()
  @IsUUID()
  testId?: string;

  @IsOptional()
  @IsUUID()
  packageId?: string;
}
