import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Anthropic from '@anthropic-ai/sdk';
import { AiService } from './ai.service';
import { Prescription, PrescriptionMatch } from './entities/prescription.entity';
import { TestsService } from '../catalog/tests.service';
import { PackagesService } from '../catalog/packages.service';
import { buildCatalogContext } from './catalog-context';
import { TestFinderDto } from './dto/test-finder.dto';

export type PublicPrescription = Omit<Prescription, 'fileData'>;

interface PrescriptionReading {
  readable: boolean;
  doctorName: string;
  items: Array<{ writtenAs: string; catalogRef: string; confidence: 'high' | 'medium' | 'low' }>;
  notes: string;
}

interface TestFinderAnswer {
  urgent: boolean;
  urgentMessage: string;
  suggestions: Array<{ catalogRef: string; reason: string }>;
  advice: string;
}

@Injectable()
export class PrescriptionsService {
  private readonly logger = new Logger(PrescriptionsService.name);

  constructor(
    @InjectRepository(Prescription)
    private readonly prescriptionsRepo: Repository<Prescription>,
    private readonly ai: AiService,
    private readonly testsService: TestsService,
    private readonly packagesService: PackagesService,
  ) {}

  private async catalog() {
    const [tests, packages] = await Promise.all([
      this.testsService.findAllActive(),
      this.packagesService.findAllActive(),
    ]);
    return buildCatalogContext(tests, packages);
  }

  // Reads the tests a doctor ordered off a prescription photo/PDF and maps
  // each one to what we actually sell. Anything written on it that we
  // don't offer comes back unmatched (kind/catalogId null) so the customer
  // sees it rather than it silently disappearing.
  async readPrescription(customerId: string, file: Express.Multer.File): Promise<PublicPrescription> {
    const catalog = await this.catalog();
    const data = file.buffer.toString('base64');
    const fileBlock: Anthropic.Beta.BetaContentBlockParam =
      file.mimetype === 'application/pdf'
        ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } }
        : {
            type: 'image',
            source: {
              type: 'base64',
              media_type: file.mimetype as 'image/jpeg' | 'image/png' | 'image/webp',
              data,
            },
          };

    // If the automatic reading fails (AI down, not configured, unreadable
    // file), the upload is still saved: the lab sees it in the admin inbox
    // and calls the customer, so the customer's effort is never lost.
    let reading: PrescriptionReading;
    try {
      reading = await this.readWithAi(fileBlock, catalog.text, catalog.refs);
    } catch (err) {
      this.logger.warn(`Prescription reading failed: ${(err as Error).message}`);
      reading = {
        readable: false,
        doctorName: '',
        items: [],
        notes: "We've received your prescription. Our team will review it and call you to confirm the tests.",
      };
    }

    // The same catalog item written twice ("CBC" and "Hb, TLC, DLC") only
    // needs booking once.
    const seen = new Set<string>();
    const matches: PrescriptionMatch[] = [];
    for (const item of reading.readable ? reading.items : []) {
      const entry = catalog.byRef.get(item.catalogRef);
      if (entry && seen.has(entry.ref)) continue;
      if (entry) seen.add(entry.ref);
      matches.push({
        writtenAs: item.writtenAs,
        kind: entry?.kind ?? null,
        catalogId: entry?.id ?? null,
        name: entry?.name ?? null,
        price: entry?.price ?? null,
        confidence: item.confidence,
      });
    }

    const saved = await this.prescriptionsRepo.save(
      this.prescriptionsRepo.create({
        customerId,
        fileData: file.buffer,
        fileName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        matches,
        doctorName: reading.doctorName || undefined,
        notes: reading.readable
          ? reading.notes || undefined
          : reading.notes || "We couldn't read tests on this image. Our team will look at it and call you back.",
      }),
    );
    return this.toPublic(saved);
  }

  private readWithAi(
    fileBlock: Anthropic.Beta.BetaContentBlockParam,
    catalogText: string,
    refs: string[],
  ): Promise<PrescriptionReading> {
    return this.ai.json<PrescriptionReading>({
      system:
        'You read doctor prescriptions for an Indian diagnostic lab so a patient can book the lab tests ' +
        'their doctor ordered. Prescriptions are often handwritten and use abbreviations (CBC, LFT, KFT/RFT, ' +
        'TSH, T3 T4, HbA1c, FBS/PPBS, Lipid profile, Vit D, B12, CRP, ESR, urine R/E, etc.). ' +
        'List only investigations / lab tests — ignore medicines, dosages and advice. For each one, pick the ' +
        'single best matching catalog ref, or "none" if the catalog has nothing equivalent. Prefer a package ' +
        'only when the prescription literally asks for that package. Use confidence "low" when the handwriting ' +
        'is hard to read. If the image is not a prescription or nothing is legible, set readable to false.',
      content: [
        fileBlock,
        {
          type: 'text',
          text: `Our catalog (ref | kind | name | details):\n${catalogText}\n\nRead the prescription above and map every lab test on it to a catalog ref.`,
        },
      ],
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['readable', 'doctorName', 'items', 'notes'],
        properties: {
          readable: { type: 'boolean' },
          doctorName: { type: 'string', description: 'Doctor or clinic name if visible, else empty string' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['writtenAs', 'catalogRef', 'confidence'],
              properties: {
                writtenAs: { type: 'string', description: 'The test as written on the prescription' },
                catalogRef: { type: 'string', enum: [...refs, 'none'] },
                confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
              },
            },
          },
          notes: {
            type: 'string',
            description: 'One short sentence for the patient, e.g. fasting needed, or what could not be read. Empty if nothing to add.',
          },
        },
      },
    });
  }

  // "Not sure which test?" — symptoms in, catalog tests out. Screens for
  // red-flag symptoms first: someone describing chest pain needs a
  // hospital, not a blood test booking.
  async findTests(dto: TestFinderDto) {
    const catalog = await this.catalog();
    const who = [dto.age != null ? `${dto.age} years old` : null, dto.gender?.toLowerCase()].filter(Boolean).join(', ');

    const answer = await this.ai.json<TestFinderAnswer>({
      system:
        'You help visitors of an Indian diagnostic lab website choose which lab tests to book. You are not a ' +
        'doctor and never diagnose or name a disease as the cause. Suggest 1-4 catalog items that are commonly ' +
        'used to check the described concern, each with a one-sentence plain-language reason. If the symptoms ' +
        'sound like an emergency (chest pain, difficulty breathing, stroke signs, heavy bleeding, fainting, ' +
        'suicidal thoughts, severe pain), set urgent to true and put advice to seek emergency care / call 108 ' +
        'in urgentMessage. Advice is one short sentence recommending they also consult a doctor.',
      content: [
        {
          type: 'text',
          text: `Our catalog (ref | kind | name | details):\n${catalog.text}\n\nVisitor${who ? ` (${who})` : ''} says: "${dto.symptoms}"`,
        },
      ],
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['urgent', 'urgentMessage', 'suggestions', 'advice'],
        properties: {
          urgent: { type: 'boolean' },
          urgentMessage: { type: 'string' },
          suggestions: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['catalogRef', 'reason'],
              properties: {
                catalogRef: { type: 'string', enum: catalog.refs },
                reason: { type: 'string' },
              },
            },
          },
          advice: { type: 'string' },
        },
      },
    });

    const seen = new Set<string>();
    const suggestions = answer.suggestions.flatMap((s) => {
      const entry = catalog.byRef.get(s.catalogRef);
      if (!entry || seen.has(entry.ref)) return [];
      seen.add(entry.ref);
      return [{ kind: entry.kind, catalogId: entry.id, name: entry.name, price: entry.price, reason: s.reason }];
    });

    return {
      urgent: answer.urgent,
      urgentMessage: answer.urgent ? answer.urgentMessage : null,
      suggestions,
      advice: answer.advice,
    };
  }

  async findMine(customerId: string): Promise<PublicPrescription[]> {
    const rows = await this.prescriptionsRepo.find({
      where: { customerId },
      order: { createdAt: 'DESC' },
      take: 20,
    });
    return rows.map((r) => this.toPublic(r));
  }

  async findAllForAdmin(): Promise<Array<PublicPrescription & { customerName?: string; customerPhone?: string }>> {
    const rows = await this.prescriptionsRepo
      .createQueryBuilder('p')
      .leftJoin('users', 'u', 'u.id::text = p.customer_id')
      .addSelect('u.full_name', 'customer_name')
      .addSelect('u.phone', 'customer_phone')
      .orderBy('p.created_at', 'DESC')
      .limit(200)
      .getRawAndEntities();
    return rows.entities.map((e, i) => ({
      ...this.toPublic(e),
      customerName: rows.raw[i].customer_name ?? undefined,
      customerPhone: rows.raw[i].customer_phone ?? undefined,
    }));
  }

  async getFile(id: string, user: { userId: string; role: string }): Promise<Prescription> {
    const p = await this.prescriptionsRepo.findOne({ where: { id } });
    if (!p || (user.role !== 'ADMIN' && p.customerId !== user.userId)) {
      throw new NotFoundException('Prescription not found');
    }
    return p;
  }

  async markReviewed(id: string): Promise<PublicPrescription> {
    const p = await this.prescriptionsRepo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Prescription not found');
    p.status = 'REVIEWED';
    return this.toPublic(await this.prescriptionsRepo.save(p));
  }

  private toPublic(p: Prescription): PublicPrescription {
    const { fileData: _fileData, ...rest } = p;
    return rest;
  }
}
