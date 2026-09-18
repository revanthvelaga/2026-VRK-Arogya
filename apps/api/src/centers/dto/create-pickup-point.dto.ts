import {
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePickupPointDto {
  @IsUUID()
  centerId: string;

  @IsString()
  name: string;

  @Type(() => Number)
  @IsLatitude()
  latitude: number;

  @Type(() => Number)
  @IsLongitude()
  longitude: number;

  @IsOptional()
  @IsString()
  villageName?: string;
}
