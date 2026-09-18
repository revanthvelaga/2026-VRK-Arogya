import {
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCenterDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  address?: string;

  @Type(() => Number)
  @IsLatitude()
  latitude: number;

  @Type(() => Number)
  @IsLongitude()
  longitude: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  serviceRadiusKm?: number;

  @IsOptional()
  @IsUUID()
  ownerId?: string;
}
