import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Test } from './entities/test.entity';
import { CreateTestDto } from './dto/create-test.dto';
import { UpdateTestDto } from './dto/update-test.dto';

@Injectable()
export class TestsService {
  constructor(
    @InjectRepository(Test)
    private readonly testsRepo: Repository<Test>,
  ) {}

  findAllActive(): Promise<Test[]> {
    return this.testsRepo.find({ where: { isActive: true } });
  }

  findAllForAdmin(): Promise<Test[]> {
    return this.testsRepo.find();
  }

  async findOne(id: string): Promise<Test> {
    const test = await this.testsRepo.findOne({ where: { id } });
    if (!test) throw new NotFoundException('Test not found');
    return test;
  }

  create(dto: CreateTestDto): Promise<Test> {
    const test = this.testsRepo.create(dto);
    return this.testsRepo.save(test);
  }

  async update(id: string, dto: UpdateTestDto): Promise<Test> {
    const test = await this.findOne(id);
    Object.assign(test, dto);
    return this.testsRepo.save(test);
  }

  // Soft delete: tests may already be referenced by booking_items, so we
  // deactivate rather than hard-delete.
  async remove(id: string): Promise<void> {
    const test = await this.findOne(id);
    test.isActive = false;
    await this.testsRepo.save(test);
  }
}
