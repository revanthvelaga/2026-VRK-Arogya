import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomerDocument, DocumentCategory } from './entities/customer-document.entity';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { PatientsService } from '../patients/patients.service';
import { AiContentBlock, AiService } from '../ai/ai.service';
import { Patient } from '../patients/entities/patient.entity';
import { Relationship } from '../common/enums/relationship.enum';

// Keeps one account from filling the database with files.
const MAX_DOCUMENTS_PER_ACCOUNT = 50;

interface DocumentReading {
  category: DocumentCategory;
  title: string;
  personName: string;
}

// "Aadhaar_scan (2).pdf" → "Aadhaar scan (2)"
function titleFromFileName(name: string): string {
  const base = name.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').trim();
  return (base || 'Document').slice(0, 120);
}

// Loose name match: "VENKATA RAMANA V" on a card ↔ "venkata ramana".
function matchPatient(personName: string, patients: Patient[]): Patient | undefined {
  const words = (s: string) => s.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((w) => w.length > 1);
  const printed = new Set(words(personName));
  if (!printed.size) return undefined;
  let best: { p: Patient; score: number } | undefined;
  for (const p of patients) {
    const own = words(p.fullName);
    const hits = own.filter((w) => printed.has(w)).length;
    const score = own.length ? hits / own.length : 0;
    if (hits > 0 && score >= 0.5 && (!best || score > best.score)) best = { p, score };
  }
  return best?.p;
}

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    @InjectRepository(CustomerDocument)
    private readonly docsRepo: Repository<CustomerDocument>,
    private readonly patientsService: PatientsService,
    private readonly ai: AiService,
  ) {}

  // Works out what the document is and whose it is, so the customer only
  // has to pick a file. Falls back to "Other" + the file name if the AI
  // is unavailable or can't tell — the upload never fails because of it.
  private async classify(file: Express.Multer.File, familyNames: string[]): Promise<DocumentReading> {
    const data = file.buffer.toString('base64');
    const fileBlock: AiContentBlock =
      file.mimetype === 'application/pdf'
        ? { type: 'document', mimeType: 'application/pdf', data }
        : { type: 'image', mimeType: file.mimetype, data };
    try {
      return await this.ai.json<DocumentReading>({
        system:
          'You sort personal documents that an Indian customer uploads to their health app. Pick the category: ' +
          'INSURANCE (health/life insurance card, policy, e-card, TPA card), AADHAAR (Aadhaar card or letter), ' +
          'PAN (PAN card), PRESCRIPTION (doctor prescription), MEDICAL (lab report, discharge summary, scan, ' +
          'medical certificate or bill), OTHER (anything else). Give a short title of at most 6 words, like ' +
          '"Star Health insurance card" or "Aadhaar card" — NEVER include any ID, policy, card or phone number ' +
          'in the title. personName is the person the document belongs to as printed on it, or "" if unclear.',
        content: [fileBlock, { type: 'text', text: `Family members on this account: ${familyNames.join(', ') || 'none listed'}` }],
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['category', 'title', 'personName'],
          properties: {
            category: { type: 'string', enum: Object.values(DocumentCategory) },
            title: { type: 'string' },
            personName: { type: 'string' },
          },
        },
        maxTokens: 300,
      });
    } catch (err) {
      this.logger.warn(`Document sorting failed: ${(err as Error).message}`);
      return { category: DocumentCategory.OTHER, title: titleFromFileName(file.originalname), personName: '' };
    }
  }

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

    let { category, title, patientId } = dto;
    if (!category || !title) {
      const family = (await this.patientsService.findAllForAccount(accountId)).filter((p) => p.accountId === accountId);
      const reading = await this.classify(file, family.map((p) => p.fullName));
      category = category ?? (Object.values(DocumentCategory).includes(reading.category) ? reading.category : DocumentCategory.OTHER);
      title = title ?? (reading.title.trim().slice(0, 120) || titleFromFileName(file.originalname));
      if (!patientId && reading.personName) {
        const person = matchPatient(reading.personName, family);
        if (person && person.relationship !== Relationship.SELF) patientId = person.id;
      }
    }

    const saved = await this.docsRepo.save(
      this.docsRepo.create({
        accountId,
        patientId: patientId ?? null,
        category,
        title: title.trim(),
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
