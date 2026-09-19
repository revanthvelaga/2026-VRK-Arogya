import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { Audience } from '../../common/enums/audience.enum';

export class CreatePackageDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsUUID()
  centerId?: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  testIds: string[];

  @IsOptional()
  @IsEnum(Audience)
  audience?: Audience;
}
