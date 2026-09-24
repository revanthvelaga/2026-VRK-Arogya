import { PartialType } from '@nestjs/mapped-types';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCouponDto {
  @Matches(/^[A-Za-z0-9]{3,20}$/, { message: 'Code must be 3-20 letters or digits' })
  code: string;

  @IsString()
  @MaxLength(200)
  description: string;

  @IsIn(['PERCENT', 'FLAT'])
  discountType: 'PERCENT' | 'FLAT';

  @IsNumber()
  @Min(1)
  value: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxDiscount?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrder?: number;

  @IsOptional()
  @IsDateString()
  validUntil?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  usageLimit?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  perCustomerLimit?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCouponDto extends PartialType(CreateCouponDto) {}

export class ValidateCouponDto {
  @IsString()
  @MaxLength(30)
  code: string;

  @IsNumber()
  @Min(0)
  subtotal: number;
}

export class ApplyReferralDto {
  @IsString()
  @MaxLength(12)
  code: string;
}
