import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { CustomerDocument, DocumentCategory } from './entities/customer-document.entity';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { PatientsService } from '../patients/patients.service';
import { AiContentBlock, AiService } from '../ai/ai.service';
import { Patient } from '../patients/entities/patient.entity';
import { Relationship } from '../common/enums/relationship.enum';

// Keeps one account from filling the database with files.
const MAX_DOCUMENTS_PER_ACCOUNT = 50;
// Gemini's free tier can hang when busy; past this the file just stays
// under "Other" rather than showing "Sorting…" forever.
const SORT_TIMEOUT_MS = 60_000;
const SORT_STALE_MS = 3 * 60_000;

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

  async findMine(accountId: string): Promise<CustomerDocument[]> {
    // A sort that never finished (server restarted mid-way) stops showing
    // as "Sorting…" after a few minutes.
    await this.docsRepo.update(
      { accountId, sortPending: true, createdAt: LessThan(new Date(Date.now() - SORT_STALE_MS)) },
      { sortPending: false },
    );
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

    // Saved straight away; anything the customer didn't say is filled in
    // by the AI in the background, so the upload never waits on it.
    const needsSorting = !dto.category || !dto.title;
    const saved = await this.docsRepo.save(
      this.docsRepo.create({
        accountId,
        patientId: dto.patientId ?? null,
        category: dto.category ?? DocumentCategory.OTHER,
        title: (dto.title ?? titleFromFileName(file.originalname)).trim(),
        fileData: file.buffer,
        fileName: file.originalname.replace(/["\r\n]/g, '_'),
        mimeType: file.mimetype,
        sizeBytes: file.size,
        sortPending: needsSorting,
      }),
    );
    if (needsSorting) void this.sortInBackground(saved.id, accountId, dto, file);
    const { fileData: _bytes, ...rest } = saved;
    return rest as CustomerDocument;
  }

  private async sortInBackground(
    id: string,
    accountId: string,
    dto: UploadDocumentDto,
    file: Express.Multer.File,
  ): Promise<void> {
    try {
      const family = (await this.patientsService.findAllForAccount(accountId)).filter((p) => p.accountId === accountId);
      const reading = await Promise.race([
        this.classify(file, family.map((p) => p.fullName)),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), SORT_TIMEOUT_MS)),
      ]);
      const update: Partial<CustomerDocument> = { sortPending: false };
      if (reading) {
        if (!dto.category && Object.values(DocumentCategory).includes(reading.category)) update.category = reading.category;
        const title = reading.title.trim().slice(0, 120);
        if (!dto.title && title) update.title = title;
        if (!dto.patientId && reading.personName) {
          const person = matchPatient(reading.personName, family);
          if (person && person.relationship !== Relationship.SELF) update.patientId = person.id;
        }
      } else {
        this.logger.warn(`Document sorting timed out for ${id}`);
      }
      await this.docsRepo.update(id, update);
    } catch (err) {
      this.logger.warn(`Document sorting failed for ${id}: ${(err as Error).message}`);
      await this.docsRepo.update(id, { sortPending: false }).catch(() => undefined);
    }
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
