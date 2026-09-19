import { PartialType } from '@nestjs/mapped-types';
import { CreatePartnerLabDto } from './create-partner-lab.dto';

export class UpdatePartnerLabDto extends PartialType(CreatePartnerLabDto) {}
