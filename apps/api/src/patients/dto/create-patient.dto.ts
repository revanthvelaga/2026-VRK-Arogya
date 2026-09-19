import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
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
}
