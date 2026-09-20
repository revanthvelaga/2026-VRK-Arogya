import { IsDateString, IsEnum, IsLatitude, IsLongitude, IsOptional, IsString } from 'class-validator';
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
}
