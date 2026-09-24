import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Package } from './entities/package.entity';
import { Test } from './entities/test.entity';
import { CreatePackageDto } from './dto/create-package.dto';
import { UpdatePackageDto } from './dto/update-package.dto';

@Injectable()
export class PackagesService {
  constructor(
    @InjectRepository(Package)
    private readonly packagesRepo: Repository<Package>,
    @InjectRepository(Test)
    private readonly testsRepo: Repository<Test>,
  ) {}

  findAllActive(): Promise<Package[]> {
    return this.packagesRepo.find({
      where: { isActive: true },
      relations: ['tests'],
    });
  }

  findAllForAdmin(): Promise<Package[]> {
    return this.packagesRepo.find({ relations: ['tests'] });
  }

  async findOne(id: string): Promise<Package> {
    const pkg = await this.packagesRepo.findOne({
      where: { id },
      relations: ['tests'],
    });
    if (!pkg) throw new NotFoundException('Package not found');
    return pkg;
  }

  async create(dto: CreatePackageDto): Promise<Package> {
    const tests = await this.testsRepo.findBy({ id: In(dto.testIds) });
    const pkg = this.packagesRepo.create({
      name: dto.name,
      description: dto.description,
      price: dto.price,
      centerId: dto.centerId,
      audience: dto.audience,
      tier: dto.tier || null,
      tests,
    });
    return this.packagesRepo.save(pkg);
  }

  async update(id: string, dto: UpdatePackageDto): Promise<Package> {
    const pkg = await this.findOne(id);
    const { testIds, tier, ...rest } = dto;
    Object.assign(pkg, rest);
    if (tier !== undefined) pkg.tier = tier || null;
    if (testIds) {
      pkg.tests = await this.testsRepo.findBy({ id: In(testIds) });
    }
    return this.packagesRepo.save(pkg);
  }

  async remove(id: string): Promise<void> {
    const pkg = await this.findOne(id);
    pkg.isActive = false;
    await this.packagesRepo.save(pkg);
  }
}
