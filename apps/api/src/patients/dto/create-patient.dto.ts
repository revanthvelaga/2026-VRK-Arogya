import { IsDateString, IsEnum, IsLatitude, IsLongitude, IsOptional, IsString, Matches, ValidateIf } from 'class-validator';
import { Relationship } from '../../common/enums/relationship.enum';
import { Gender } from '../../common/enums/gender.enum';

export class CreatePatientDto {
  @IsString()
  fullName: string;

  @IsEnum(Relationship)
  relationship: Relationship;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  areaAddress?: string;

  @IsOptional()
  @IsString()
  pincode?: string;

  @IsOptional()
  @IsString()
  fullAddress?: string;

  @IsOptional()
  @IsString()
  landmark?: string;

  // Required together — set only when areaAddress came from picking a map
  // suggestion, not when it's left blank or typed free-form.
  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  alternatePhone?: string;

  // 14 digits, with or without the usual 2-4-4-4 dashes. '' clears it.
  @IsOptional()
  @ValidateIf((_, v) => v !== '')
  @Matches(/^\d{2}-?\d{4}-?\d{4}-?\d{4}$/, { message: 'ABHA number must be 14 digits (e.g. 12-3456-7890-1234)' })
  abhaNumber?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== '')
  @Matches(/^[a-zA-Z0-9._]{3,40}@(abdm|sbx)$/, { message: 'ABHA address looks like yourname@abdm' })
  abhaAddress?: string;
}
