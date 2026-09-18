import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreatePickupPointDto } from './create-pickup-point.dto';

// centerId is fixed at creation — moving a pickup point to a different
// center isn't supported yet.
export class UpdatePickupPointDto extends PartialType(
  OmitType(CreatePickupPointDto, ['centerId'] as const),
) {}
