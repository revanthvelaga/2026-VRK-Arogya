import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PartnerLab } from './entities/partner-lab.entity';
import { CreatePartnerLabDto } from './dto/create-partner-lab.dto';
import { UpdatePartnerLabDto } from './dto/update-partner-lab.dto';

@Injectable()
export class PartnerLabsService {
  constructor(
    @InjectRepository(PartnerLab)
    private readonly partnerLabsRepo: Repository<PartnerLab>,
  ) {}

  findAll(): Promise<PartnerLab[]> {
    return this.partnerLabsRepo.find();
  }

  async findOne(id: string): Promise<PartnerLab> {
    const partnerLab = await this.partnerLabsRepo.findOne({ where: { id } });
    if (!partnerLab) throw new NotFoundException('Partner lab not found');
    return partnerLab;
  }

  create(dto: CreatePartnerLabDto): Promise<PartnerLab> {
    const partnerLab = this.partnerLabsRepo.create(dto);
    return this.partnerLabsRepo.save(partnerLab);
  }

  async update(id: string, dto: UpdatePartnerLabDto): Promise<PartnerLab> {
    const partnerLab = await this.findOne(id);
    Object.assign(partnerLab, dto);
    return this.partnerLabsRepo.save(partnerLab);
  }
}
