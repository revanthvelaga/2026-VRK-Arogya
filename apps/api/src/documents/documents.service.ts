import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomerDocument } from './entities/customer-document.entity';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { PatientsService } from '../patients/patients.service';

// Keeps one account from filling the database with files.
const MAX_DOCUMENTS_PER_ACCOUNT = 50;

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(CustomerDocument)
    private readonly docsRepo: Repository<CustomerDocument>,
    private readonly patientsService: PatientsService,
  ) {}

  findMine(accountId: string): Promise<CustomerDocument[]> {
    return this.docsRepo.find({ where: { accountId }, order: { createdAt: 'DESC' } });
  }

  async upload(accountId: string, dto: UploadDocumentDto, file: Express.Multer.File): Promise<CustomerDocument> {
    if (dto.patientId) {
      const patient = await this.patientsService.findOne(dto.patientId);
      if (patient.accountId !== accountId) throw new ForbiddenException('Not your family member');
    }
    if ((await this.docsRepo.count({ where: { accountId } })) >= MAX_DOCUMENTS_PER_ACCOUNT) {
      throw new BadRequestException(`You can keep up to ${MAX_DOCUMENTS_PER_ACCOUNT} documents. Delete one to add another.`);
    }
    const saved = await this.docsRepo.save(
      this.docsRepo.create({
        accountId,
        patientId: dto.patientId ?? null,
        category: dto.category,
        title: dto.title.trim(),
        fileData: file.buffer,
        fileName: file.originalname.replace(/["\r\n]/g, '_'),
        mimeType: file.mimetype,
        sizeBytes: file.size,
      }),
    );
    const { fileData: _bytes, ...rest } = saved;
    return rest as CustomerDocument;
  }

  // Owner only — the bytes never go to anyone else, staff included.
  async getForDownload(id: string, accountId: string): Promise<CustomerDocument> {
    const doc = await this.docsRepo
      .createQueryBuilder('d')
      .addSelect('d.fileData')
      .where('d.id = :id', { id })
      .getOne();
    if (!doc || doc.accountId !== accountId) throw new NotFoundException('Document not found');
    return doc;
  }

  async remove(id: string, accountId: string): Promise<void> {
    const doc = await this.docsRepo.findOne({ where: { id } });
    if (!doc || doc.accountId !== accountId) throw new NotFoundException('Document not found');
    await this.docsRepo.delete(id);
  }
}
