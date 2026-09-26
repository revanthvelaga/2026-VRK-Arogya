import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { VitalReading } from './entities/vital-reading.entity';
import { HealthGoal } from './entities/health-goal.entity';
import { Medicine } from './entities/medicine.entity';
import { RetestReminder } from './entities/retest-reminder.entity';
import { CreateGoalDto, CreateMedicineDto, CreateVitalDto, UpdateGoalDto, UpdateMedicineDto } from './dto/health.dto';
import { AiService } from '../ai/ai.service';
import { PatientsService } from '../patients/patients.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../common/enums/notification-type.enum';
import { retestIntervalDays } from './retest';

const DAY = 24 * 3600_000;
const REMIND_AHEAD_DAYS = 7;
const JOB_INTERVAL_MS = 6 * 3600_000;

export interface RetestItem {
  testId: string;
  testName: string;
  price: number;
  lastTestedAt: Date;
  intervalDays: number;
  dueAt: Date;
  status: 'OVERDUE' | 'DUE_SOON' | 'OK' | 'BOOKED';
}

@Injectable()
export class HealthService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HealthService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    @InjectRepository(VitalReading) private readonly vitalsRepo: Repository<VitalReading>,
    @InjectRepository(HealthGoal) private readonly goalsRepo: Repository<HealthGoal>,
    @InjectRepository(Medicine) private readonly medicinesRepo: Repository<Medicine>,
    @InjectRepository(RetestReminder) private readonly remindersRepo: Repository<RetestReminder>,
    private readonly patientsService: PatientsService,
    private readonly notificationsService: NotificationsService,
    private readonly dataSource: DataSource,
    private readonly ai: AiService,
  ) {}

  // Every read and write here is for one patient, and only their own
  // account may touch it.
  private assertPatient(patientId: string, userId: string) {
    return this.patientsService.findOneForAccount(patientId, userId);
  }

  // ---- Vitals -------------------------------------------------------

  async listVitals(patientId: string, userId: string) {
    await this.assertPatient(patientId, userId);
    const rows = await this.vitalsRepo.find({ where: { patientId }, order: { recordedAt: 'DESC' }, take: 500 });
    return rows.map((r) => ({ ...r, value: Number(r.value), value2: r.value2 != null ? Number(r.value2) : null }));
  }

  async addVital(dto: CreateVitalDto, userId: string) {
    await this.assertPatient(dto.patientId, userId);
    if (dto.type === 'BP' && dto.value2 == null) {
      throw new BadRequestException('Blood pressure needs both numbers (e.g. 120 / 80)');
    }
    const recordedAt = dto.recordedAt ? new Date(dto.recordedAt) : new Date();
    if (recordedAt.getTime() > Date.now() + 5 * 60_000) throw new BadRequestException("A reading can't be in the future");
    const saved = await this.vitalsRepo.save(
      this.vitalsRepo.create({
        patientId: dto.patientId,
        recordedBy: userId,
        type: dto.type,
        value: dto.value,
        value2: dto.type === 'BP' ? dto.value2 : null,
        recordedAt,
        note: dto.note?.trim() || null,
      }),
    );
    return { ...saved, value: Number(saved.value), value2: saved.value2 != null ? Number(saved.value2) : null };
  }

  async deleteVital(id: string, userId: string) {
    const row = await this.vitalsRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Reading not found');
    await this.assertPatient(row.patientId, userId);
    await this.vitalsRepo.delete(id);
  }

  // ---- Goals --------------------------------------------------------

  async listGoals(patientId: string, userId: string) {
    await this.assertPatient(patientId, userId);
    const rows = await this.goalsRepo.find({ where: { patientId }, order: { createdAt: 'ASC' } });
    return rows.map((g) => this.goalOut(g));
  }

  private goalOut(g: HealthGoal) {
    return { ...g, target: Number(g.target), startValue: g.startValue != null ? Number(g.startValue) : null };
  }

  async addGoal(dto: CreateGoalDto, userId: string) {
    await this.assertPatient(dto.patientId, userId);
    const count = await this.goalsRepo.count({ where: { patientId: dto.patientId } });
    if (count >= 10) throw new BadRequestException('Up to 10 goals per person');
    const saved = await this.goalsRepo.save(
      this.goalsRepo.create({
        ...dto,
        unit: dto.unit ?? null,
        startValue: dto.startValue ?? null,
        targetDate: dto.targetDate ? dto.targetDate.slice(0, 10) : null,
      }),
    );
    return this.goalOut(saved);
  }

  async updateGoal(id: string, dto: UpdateGoalDto, userId: string) {
    const goal = await this.goalsRepo.findOne({ where: { id } });
    if (!goal) throw new NotFoundException('Goal not found');
    await this.assertPatient(goal.patientId, userId);
    if (dto.label !== undefined) goal.label = dto.label;
    if (dto.direction !== undefined) goal.direction = dto.direction;
    if (dto.target !== undefined) goal.target = dto.target;
    if (dto.targetDate !== undefined) goal.targetDate = dto.targetDate ? dto.targetDate.slice(0, 10) : null;
    return this.goalOut(await this.goalsRepo.save(goal));
  }

  // The readings a goal is measured against, oldest first.
  private async goalSeries(goal: HealthGoal): Promise<Array<{ date: Date; value: number }>> {
    if (goal.metric.startsWith('test:')) {
      const rows = (await this.dataSource.query(
        `SELECT rv.value, r.generated_at
           FROM report_values rv
           JOIN reports r ON r.id = rv.report_id
           JOIN bookings b ON b.id = r.booking_id
          WHERE b.patient_id = $1 AND rv.test_id = $2
          ORDER BY r.generated_at`,
        [goal.patientId, goal.metric.slice(5)],
      )) as Array<{ value: string; generated_at: Date }>;
      return rows.map((r) => ({ date: new Date(r.generated_at), value: Number(r.value) }));
    }
    const rows = await this.vitalsRepo.find({
      where: { patientId: goal.patientId, type: goal.metric as VitalReading['type'] },
      order: { recordedAt: 'ASC' },
      take: 500,
    });
    return rows.map((r) => ({ date: r.recordedAt, value: Number(r.value) }));
  }

  // A few practical, goal-specific tips — not medical advice, and never a
  // change to medicines.
  async goalAdvice(id: string, userId: string): Promise<{ advice: string }> {
    const goal = await this.goalsRepo.findOne({ where: { id } });
    if (!goal) throw new NotFoundException('Goal not found');
    const patient = await this.assertPatient(goal.patientId, userId);
    const series = (await this.goalSeries(goal)).slice(-20);
    const unit = goal.unit ?? '';
    const day = (d: Date) => d.toISOString().slice(0, 10);
    const age = patient.dateOfBirth
      ? Math.floor((Date.now() - new Date(patient.dateOfBirth).getTime()) / (365.25 * 24 * 3600 * 1000))
      : null;
    const facts = [
      `Goal: ${goal.label} (keep it ${goal.direction.toLowerCase()} ${Number(goal.target)} ${unit}).`,
      goal.startValue != null ? `Started at ${Number(goal.startValue)} ${unit} on ${day(goal.createdAt)}.` : '',
      goal.targetDate ? `Wants to reach it by ${goal.targetDate}. Today is ${day(new Date())}.` : 'No deadline set.',
      series.length
        ? `Readings (date: value): ${series.map((r) => `${day(r.date)}: ${r.value}`).join(', ')}.`
        : 'No readings logged yet.',
      age != null ? `Age about ${age}.` : '',
      patient.gender ? `Gender: ${patient.gender.toLowerCase()}.` : '',
    ].filter(Boolean);
    const advice = await this.ai.text({
      system:
        'You are a friendly health coach inside an Indian diagnostic-lab app. Given one personal goal and the ' +
        'readings so far, reply in plain simple English with: first one short line on how they are doing and ' +
        'whether the pace is realistic (safe weight change is about 0.5–1 kg per week); then 3 or 4 short, ' +
        'practical tips as lines starting with "- ", suited to Indian food and daily routine. Never suggest ' +
        'starting, stopping or changing any medicine; if readings look worrying (very high sugar or BP, fast ' +
        'unexplained weight change), say to see a doctor. No headings, no markdown bold, under 120 words.',
      prompt: facts.join('\n'),
      maxTokens: 400,
    });
    return { advice: advice.trim() };
  }

  async deleteGoal(id: string, userId: string) {
    const row = await this.goalsRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Goal not found');
    await this.assertPatient(row.patientId, userId);
    await this.goalsRepo.delete(id);
  }

  // ---- Medicines ----------------------------------------------------

  async listMedicines(patientId: string, userId: string) {
    await this.assertPatient(patientId, userId);
    return this.medicinesRepo.find({ where: { patientId }, order: { isActive: 'DESC', createdAt: 'DESC' } });
  }

  async addMedicine(dto: CreateMedicineDto, userId: string) {
    await this.assertPatient(dto.patientId, userId);
    return this.medicinesRepo.save(
      this.medicinesRepo.create({
        patientId: dto.patientId,
        name: dto.name.trim(),
        dosage: dto.dosage?.trim() || null,
        schedule: dto.schedule?.trim() || null,
      }),
    );
  }

  async updateMedicine(id: string, dto: UpdateMedicineDto, userId: string) {
    const row = await this.medicinesRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Medicine not found');
    await this.assertPatient(row.patientId, userId);
    Object.assign(row, dto);
    return this.medicinesRepo.save(row);
  }

  async deleteMedicine(id: string, userId: string) {
    const row = await this.medicinesRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Medicine not found');
    await this.assertPatient(row.patientId, userId);
    await this.medicinesRepo.delete(id);
  }

  // ---- Retests ------------------------------------------------------

  async listRetests(patientId: string, userId: string): Promise<RetestItem[]> {
    await this.assertPatient(patientId, userId);
    return this.computeRetests(patientId);
  }

  // When each test this patient has actually had was last done — from
  // report results (their own dates) and from bookings that got as far as
  // collection — and when it's next due. A test already on an upcoming
  // booking shows as BOOKED rather than nagging.
  private async computeRetests(patientId: string): Promise<RetestItem[]> {
    const done = (await this.dataSource.query(
      `SELECT t.id AS test_id, t.name, t.price, MAX(x.tested_at) AS last_tested
         FROM (
           SELECT COALESCE(bi.test_id, pt.test_id::text) AS test_id, b.scheduled_at AS tested_at
             FROM bookings b
             JOIN booking_items bi ON bi.booking_id = b.id
             LEFT JOIN package_tests pt ON pt.package_id::text = bi.package_id
            WHERE b.patient_id = $1 AND b.status <> 'CANCELLED'
              AND (b.status = 'COMPLETED'
                   OR EXISTS (SELECT 1 FROM reports r WHERE r.booking_id = b.id)
                   OR EXISTS (SELECT 1 FROM samples s WHERE s.booking_id = b.id AND s.collected_at IS NOT NULL))
           UNION ALL
           SELECT rv.test_id, r.generated_at
             FROM report_values rv
             JOIN reports r ON r.id = rv.report_id
             JOIN bookings b ON b.id = r.booking_id
            WHERE b.patient_id = $1 AND rv.test_id IS NOT NULL
         ) x
         JOIN tests t ON t.id::text = x.test_id
        WHERE t.is_active
        GROUP BY t.id, t.name, t.price`,
      [patientId],
    )) as Array<{ test_id: string; name: string; price: string; last_tested: Date }>;

    const upcoming = (await this.dataSource.query(
      `SELECT DISTINCT COALESCE(bi.test_id, pt.test_id::text) AS test_id
         FROM bookings b
         JOIN booking_items bi ON bi.booking_id = b.id
         LEFT JOIN package_tests pt ON pt.package_id::text = bi.package_id
        WHERE b.patient_id = $1 AND b.status IN ('PENDING', 'CONFIRMED') AND b.scheduled_at > now()`,
      [patientId],
    )) as Array<{ test_id: string }>;
    const booked = new Set(upcoming.map((u) => u.test_id));

    const now = Date.now();
    return done
      .flatMap((row): RetestItem[] => {
        const intervalDays = retestIntervalDays(row.name);
        if (intervalDays == null) return [];
        const last = new Date(row.last_tested);
        const dueAt = new Date(last.getTime() + intervalDays * DAY);
        const status = booked.has(row.test_id)
          ? 'BOOKED'
          : dueAt.getTime() < now
            ? 'OVERDUE'
            : dueAt.getTime() < now + 30 * DAY
              ? 'DUE_SOON'
              : 'OK';
        return [
          {
            testId: row.test_id,
            testName: row.name,
            price: Number(row.price),
            lastTestedAt: last,
            intervalDays,
            dueAt,
            status,
          },
        ];
      })
      .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
  }

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    setTimeout(() => void this.sendRetestReminders(), 60_000).unref();
    this.timer = setInterval(() => void this.sendRetestReminders(), JOB_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  // A week before a test falls due (or as soon as it's found overdue),
  // the account holder gets one reminder per result.
  async sendRetestReminders(): Promise<number> {
    let sent = 0;
    try {
      const patients = (await this.dataSource.query(
        `SELECT DISTINCT p.id, p.account_id, p.full_name, p.relationship
           FROM patients p JOIN bookings b ON b.patient_id = p.id::text
          WHERE b.status <> 'CANCELLED'`,
      )) as Array<{ id: string; account_id: string; full_name: string; relationship: string }>;

      for (const p of patients) {
        const items = await this.computeRetests(p.id);
        for (const item of items) {
          if (item.status === 'BOOKED' || item.dueAt.getTime() > Date.now() + REMIND_AHEAD_DAYS * DAY) continue;
          const already = await this.remindersRepo.findOne({
            where: { patientId: p.id, testId: item.testId, lastTestedAt: item.lastTestedAt },
          });
          if (already) continue;
          await this.remindersRepo.save(
            this.remindersRepo.create({ patientId: p.id, testId: item.testId, lastTestedAt: item.lastTestedAt }),
          );
          const who = p.relationship === 'SELF' ? 'your' : `${p.full_name}'s`;
          const last = item.lastTestedAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
          await this.notificationsService.notify(
            p.account_id,
            NotificationType.RETEST_DUE,
            `Time for ${who} ${item.testName} recheck — last done on ${last}. Rebook from Insights in one tap.`,
            p.id,
          );
          sent++;
        }
      }
      if (sent) this.logger.log(`Sent ${sent} retest reminder(s)`);
    } catch (err) {
      this.logger.error('Retest reminder run failed', err instanceof Error ? err.stack : err);
    }
    return sent;
  }
}
