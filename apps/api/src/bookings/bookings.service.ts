import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Booking } from './entities/booking.entity';
import { BookingItem } from './entities/booking-item.entity';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
import { CollectionMode } from '../common/enums/collection-mode.enum';
import { BookingStatus } from '../common/enums/booking-status.enum';
import { Role } from '../common/enums/role.enum';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { CentersService } from '../centers/centers.service';
import { DiagnosticCenter } from '../centers/entities/diagnostic-center.entity';
import { PickupPointsService } from '../centers/pickup-points.service';
import { TestsService } from '../catalog/tests.service';
import { PackagesService } from '../catalog/packages.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../common/enums/notification-type.enum';
import { toGeoPoint } from '../common/utils/geo.util';
import { PatientsService } from '../patients/patients.service';
import { UsersService } from '../users/users.service';
import { CouponsService } from '../rewards/coupons.service';
import { WalletService } from '../rewards/wallet.service';
import { PaymentStatus } from '../common/enums/payment-status.enum';

interface PricedItem {
  testId?: string;
  packageId?: string;
  price: number;
}

export interface BookingCustomer {
  fullName: string;
  phone?: string;
  email?: string;
}

export interface BookingPatient {
  fullName: string;
  relationship: string;
  gender?: string;
  dateOfBirth?: string;
  phone?: string;
}

export interface BookingAgent {
  id: string;
  fullName: string;
  phone?: string;
}

export type BookingWithPeople = Booking & {
  customer?: BookingCustomer;
  patient?: BookingPatient;
  centerName?: string;
  // Where the sample is (or will be) collected from and who's collecting
  // it — visible to the customer too, unlike `customer`/`patient` above,
  // which are staff/admin-only.
  centerAddress?: string;
  pickupPointName?: string;
  assignedAgent?: BookingAgent;
};

// Applied on top of item prices at booking time — illustrative until real
// invoicing rules replace it.
const GST_RATE = 0.18;

const round2 = (n: number) => Math.round(n * 100) / 100;

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingsRepo: Repository<Booking>,
    private readonly dataSource: DataSource,
    private readonly centersService: CentersService,
    private readonly pickupPointsService: PickupPointsService,
    private readonly testsService: TestsService,
    private readonly packagesService: PackagesService,
    private readonly notificationsService: NotificationsService,
    private readonly patientsService: PatientsService,
    private readonly usersService: UsersService,
    private readonly couponsService: CouponsService,
    private readonly walletService: WalletService,
  ) {}

  async create(customerId: string, dto: CreateBookingDto): Promise<Booking> {
    // Ownership check — a customer can only book for their own patient
    // profiles (themselves or a family member they added), never someone
    // else's.
    await this.patientsService.findOneForAccount(dto.patientId, customerId);

    const center = await this.centersService.findOne(dto.centerId);
    if (!center.isActive) {
      throw new BadRequestException('Diagnostic center is not active');
    }

    if (dto.collectionMode === CollectionMode.PICKUP_POINT) {
      if (!dto.pickupPointId) {
        throw new BadRequestException(
          'pickupPointId is required for PICKUP_POINT collection mode',
        );
      }
      const pickupPoint = await this.pickupPointsService.findOne(dto.pickupPointId);
      if (!pickupPoint.isActive || pickupPoint.centerId !== dto.centerId) {
        throw new BadRequestException('Pickup point not found for this center');
      }
    } else if (dto.pickupPointId) {
      throw new BadRequestException(
        'pickupPointId is only valid for PICKUP_POINT collection mode',
      );
    }

    let homeDistanceKm: number | undefined;
    if (dto.collectionMode === CollectionMode.HOME_VISIT) {
      if (
        !dto.homeAddressLine ||
        !dto.homeAddressPincode ||
        dto.homeLatitude == null ||
        dto.homeLongitude == null
      ) {
        throw new BadRequestException(
          'homeAddressLine, homeAddressPincode, homeLatitude and homeLongitude are required for HOME_VISIT collection mode',
        );
      }
      homeDistanceKm = await this.distanceKmToCenter(dto.homeLatitude, dto.homeLongitude, center);
      if (homeDistanceKm > center.serviceRadiusKm) {
        throw new BadRequestException(
          `This address is ${homeDistanceKm.toFixed(1)}km from "${center.name}", outside its ${center.serviceRadiusKm}km home-collection radius. Choose a pickup point instead.`,
        );
      }
    } else if (dto.homeAddressLine || dto.homeAddressPincode || dto.homeLatitude != null || dto.homeLongitude != null) {
      throw new BadRequestException('Home address fields are only valid for HOME_VISIT collection mode');
    }

    const scheduledAt = new Date(dto.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() < Date.now()) {
      throw new BadRequestException('scheduledAt must be a valid future date/time');
    }

    const items = await this.priceItems(dto.items);
    const subtotal = round2(items.reduce((sum, item) => sum + item.price, 0));
    // Offer first (GST is charged on the discounted amount), then wallet
    // credit comes off the final total like a partial payment. Every
    // figure is recomputed here — the checkout preview is only a preview.
    const coupon = dto.couponCode?.trim()
      ? await this.couponsService.quote(dto.couponCode, subtotal, customerId)
      : null;
    const discountAmount = coupon?.discount ?? 0;
    const taxable = round2(subtotal - discountAmount);
    // Rounded to paise — GST_RATE is illustrative; swap for the real
    // invoicing rules whenever those land.
    const gstAmount = round2(taxable * GST_RATE);
    const gross = round2(taxable + gstAmount);
    const walletUsed = dto.useWallet
      ? round2(Math.min(await this.walletService.balanceOf(customerId), gross))
      : 0;
    const totalAmount = round2(gross - walletUsed);
    // Fully covered by offer + wallet: nothing left to pay online.
    const fullyCovered = totalAmount === 0;

    const savedBooking = await this.dataSource.transaction(async (manager) => {
      const isHomeVisit = dto.collectionMode === CollectionMode.HOME_VISIT;
      const booking = manager.create(Booking, {
        customerId,
        patientId: dto.patientId,
        centerId: dto.centerId,
        pickupPointId:
          dto.collectionMode === CollectionMode.PICKUP_POINT ? dto.pickupPointId : undefined,
        collectionMode: dto.collectionMode,
        homeAddressLine: isHomeVisit ? dto.homeAddressLine : undefined,
        homeAddressPincode: isHomeVisit ? dto.homeAddressPincode : undefined,
        homeLocation: isHomeVisit ? toGeoPoint(dto.homeLatitude as number, dto.homeLongitude as number) : undefined,
        scheduledAt,
        status: BookingStatus.PENDING,
        subtotal,
        couponCode: coupon?.code ?? null,
        discountAmount,
        walletUsed,
        gstAmount,
        totalAmount,
        paymentStatus: fullyCovered ? PaymentStatus.PAID : PaymentStatus.PENDING,
      });
      const inserted = await manager.save(booking);
      await this.walletService.debit(manager, customerId, walletUsed, 'Used on a booking', inserted.id);

      const bookingItems = items.map((item) =>
        manager.create(BookingItem, { bookingId: inserted.id, ...item }),
      );
      inserted.items = await manager.save(BookingItem, bookingItems);
      return inserted;
    });

    // Notified after the transaction commits — an SMTP round-trip has no
    // business holding a database transaction (and its row locks) open.
    await this.notificationsService.notify(
      customerId,
      NotificationType.BOOKING_CREATED,
      `Your booking for ${savedBooking.scheduledAt.toLocaleString('en-IN')} is confirmed. Total: ₹${totalAmount}.`,
    );
    if (fullyCovered) await this.walletService.rewardReferralIfDue(customerId, savedBooking.id);

    return savedBooking;
  }

  // Prices are always looked up server-side from the current catalog —
  // never trusted from the client.
  private async priceItems(dtoItems: CreateBookingDto['items']): Promise<PricedItem[]> {
    const items: PricedItem[] = [];
    for (const item of dtoItems) {
      if (!!item.testId === !!item.packageId) {
        throw new BadRequestException(
          'Each item must have exactly one of testId or packageId',
        );
      }
      if (item.testId) {
        const test = await this.testsService.findOne(item.testId);
        if (!test.isActive) {
          throw new BadRequestException(`Test ${item.testId} is not active`);
        }
        items.push({ testId: test.id, price: Number(test.price) });
      } else {
        const pkg = await this.packagesService.findOne(item.packageId as string);
        if (!pkg.isActive) {
          throw new BadRequestException(`Package ${item.packageId} is not active`);
        }
        items.push({ packageId: pkg.id, price: Number(pkg.price) });
      }
    }
    return items;
  }

  async findAllForCustomer(customerId: string, patientId?: string): Promise<BookingWithPeople[]> {
    const bookings = await this.bookingsRepo.find({
      where: patientId ? { customerId, patientId } : { customerId },
      relations: ['items'],
      order: { createdAt: 'DESC' },
    });
    return this.attachLogistics(bookings);
  }

  // A field agent's own queue — every booking assigned to them that isn't
  // finished, oldest scheduled first (today's/overdue pickups surface
  // before tomorrow's). Needs the same customer/patient contact details
  // ADMIN/STAFF already see on the full booking detail page — an agent
  // can't collect from someone they don't know how to reach.
  async findAllForAgent(agentId: string): Promise<BookingWithPeople[]> {
    const bookings = await this.bookingsRepo.find({
      where: { assignedAgentId: agentId },
      relations: ['items'],
      order: { scheduledAt: 'ASC' },
    });
    const active = bookings.filter(
      (b) => b.status === BookingStatus.PENDING || b.status === BookingStatus.CONFIRMED,
    );
    const withPeople = await this.attachPeople(active);
    return this.attachLogistics(withPeople);
  }

  async findAll(): Promise<BookingWithPeople[]> {
    const bookings = await this.bookingsRepo.find({ relations: ['items'], order: { createdAt: 'DESC' } });
    const withPeople = await this.attachPeople(bookings);
    return this.attachLogistics(withPeople);
  }

  // Staff opening a booking need to know who booked it and who it's for;
  // a customer viewing their own booking already knows both. Everyone —
  // customer included — gets the logistics fields (where it's being
  // collected, who's assigned): that's their own booking's own collection
  // trip, not someone else's private data.
  async findOneDetailed(id: string, user: AuthenticatedUser): Promise<BookingWithPeople> {
    const booking = await this.findOneForUser(id, user);
    const isStaffOrAdmin = user.role === Role.ADMIN || user.role === Role.STAFF;
    const base = isStaffOrAdmin ? (await this.attachPeople([booking]))[0] : booking;
    const [withLogistics] = await this.attachLogistics([base]);
    return withLogistics;
  }

  // A booking row only stores ids. Two bulk lookups (not one per row) with
  // a deliberately narrow column list — never the password hash. Staff/admin
  // only: this is the customer's and patient's own identity, not the
  // assigned booking's own business.
  private async attachPeople(bookings: Booking[]): Promise<BookingWithPeople[]> {
    if (bookings.length === 0) return [];
    const unique = (ids: (string | undefined)[]) => [...new Set(ids.filter((id): id is string => !!id))];
    const customerIds = unique(bookings.map((b) => b.customerId));
    const patientIds = unique(bookings.map((b) => b.patientId));

    const [users, patients] = await Promise.all([
      this.dataSource.query(
        `SELECT id, full_name, phone, email FROM users WHERE id = ANY($1::uuid[])`,
        [customerIds],
      ) as Promise<Array<{ id: string; full_name: string; phone: string | null; email: string | null }>>,
      patientIds.length
        ? (this.dataSource.query(
            `SELECT id, full_name, relationship, gender, date_of_birth::text AS date_of_birth, phone
               FROM patients WHERE id = ANY($1::uuid[])`,
            [patientIds],
          ) as Promise<
            Array<{
              id: string;
              full_name: string;
              relationship: string;
              gender: string | null;
              date_of_birth: string | null;
              phone: string | null;
            }>
          >)
        : Promise.resolve([]),
    ]);

    const userById = new Map(users.map((u) => [u.id, u]));
    const patientById = new Map(patients.map((p) => [p.id, p]));

    return bookings.map((b) => {
      const u = userById.get(b.customerId);
      const p = b.patientId ? patientById.get(b.patientId) : undefined;
      return Object.assign(b, {
        customer: u ? { fullName: u.full_name, phone: u.phone ?? undefined, email: u.email ?? undefined } : undefined,
        patient: p
          ? {
              fullName: p.full_name,
              relationship: p.relationship,
              gender: p.gender ?? undefined,
              dateOfBirth: p.date_of_birth ?? undefined,
              phone: p.phone ?? undefined,
            }
          : undefined,
      });
    });
  }

  // Where the sample is collected from and who's collecting it — every
  // caller gets this, the booking's own customer included, so they know
  // where to expect a visit and who's coming.
  private async attachLogistics(bookings: BookingWithPeople[]): Promise<BookingWithPeople[]> {
    if (bookings.length === 0) return [];
    const unique = (ids: (string | undefined)[]) => [...new Set(ids.filter((id): id is string => !!id))];
    const centerIds = unique(bookings.map((b) => b.centerId));
    const pickupPointIds = unique(bookings.map((b) => b.pickupPointId));
    const agentIds = unique(bookings.map((b) => b.assignedAgentId));

    const [centers, pickupPoints, agents] = await Promise.all([
      this.dataSource.query(
        `SELECT id, name, address FROM diagnostic_centers WHERE id = ANY($1::uuid[])`,
        [centerIds],
      ) as Promise<Array<{ id: string; name: string; address: string | null }>>,
      pickupPointIds.length
        ? (this.dataSource.query(`SELECT id, name FROM pickup_points WHERE id = ANY($1::uuid[])`, [
            pickupPointIds,
          ]) as Promise<Array<{ id: string; name: string }>>)
        : Promise.resolve([]),
      agentIds.length
        ? (this.dataSource.query(
            `SELECT id, full_name, phone FROM users WHERE id = ANY($1::uuid[])`,
            [agentIds],
          ) as Promise<Array<{ id: string; full_name: string; phone: string | null }>>)
        : Promise.resolve([]),
    ]);

    const centerById = new Map(centers.map((c) => [c.id, c]));
    const pickupPointById = new Map(pickupPoints.map((p) => [p.id, p]));
    const agentById = new Map(agents.map((a) => [a.id, a]));

    return bookings.map((b) => {
      const agent = b.assignedAgentId ? agentById.get(b.assignedAgentId) : undefined;
      return Object.assign(b, {
        centerName: centerById.get(b.centerId)?.name,
        centerAddress: centerById.get(b.centerId)?.address ?? undefined,
        pickupPointName: b.pickupPointId ? pickupPointById.get(b.pickupPointId)?.name : undefined,
        assignedAgent: agent
          ? { id: agent.id, fullName: agent.full_name, phone: agent.phone ?? undefined }
          : undefined,
      });
    });
  }

  async findOne(id: string): Promise<Booking> {
    const booking = await this.bookingsRepo.findOne({ where: { id }, relations: ['items'] });
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  async findOneForUser(id: string, user: AuthenticatedUser): Promise<Booking> {
    const booking = await this.findOne(id);
    const isStaffOrAdmin = user.role === Role.ADMIN || user.role === Role.STAFF;
    if (!isStaffOrAdmin && booking.customerId !== user.userId) {
      throw new ForbiddenException('Not your booking');
    }
    return booking;
  }

  async cancel(id: string, user: AuthenticatedUser): Promise<Booking> {
    const booking = await this.findOneForUser(id, user);
    if (booking.status !== BookingStatus.PENDING && booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException(`Cannot cancel a booking with status ${booking.status}`);
    }
    booking.status = BookingStatus.CANCELLED;
    const saved = await this.bookingsRepo.save(booking);
    // Wallet credit spent on it goes straight back.
    await this.walletService.refundBooking(booking.customerId, Number(booking.walletUsed), booking.id);
    return saved;
  }

  async updateStatus(id: string, dto: UpdateBookingStatusDto): Promise<Booking> {
    const booking = await this.findOne(id);
    booking.status = dto.status;
    return this.bookingsRepo.save(booking);
  }

  // Assigns (or, with agentId null, clears) the field agent responsible
  // for this booking's collection/delivery. Only a STAFF or ADMIN user can
  // be assigned — never a customer — checked here rather than trusted from
  // the client, same as every other role check in this service.
  async assignAgent(id: string, agentId: string | null): Promise<BookingWithPeople> {
    const booking = await this.findOne(id);
    if (agentId) {
      const agent = await this.usersService.findById(agentId);
      if (!agent || (agent.role !== Role.STAFF && agent.role !== Role.ADMIN)) {
        throw new BadRequestException('Assigned agent must be an existing staff or admin user');
      }
    }
    booking.assignedAgentId = agentId ?? undefined;
    const saved = await this.bookingsRepo.save(booking);
    const [withLogistics] = await this.attachLogistics([saved]);
    return withLogistics;
  }

  // Called by PaymentsService once Razorpay confirms (or rejects) payment.
  // Not exposed as its own HTTP endpoint — payment status only ever moves
  // as a side effect of a verified payment event.
  async setPaymentStatus(id: string, status: Booking['paymentStatus']): Promise<Booking> {
    const booking = await this.findOne(id);
    const wasPaid = booking.paymentStatus === PaymentStatus.PAID;
    booking.paymentStatus = status;
    const saved = await this.bookingsRepo.save(booking);
    if (status === PaymentStatus.PAID && !wasPaid) {
      await this.walletService.rewardReferralIfDue(booking.customerId, booking.id);
    }
    return saved;
  }

  // Same PostGIS geography distance calculation PickupPointsService uses
  // for its own radius check, against an already-loaded center rather than
  // one looked up by id.
  private async distanceKmToCenter(lat: number, lng: number, center: DiagnosticCenter): Promise<number> {
    const result = await this.dataSource.query(
      `SELECT ST_Distance(
         ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
         ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography
       ) / 1000 AS distance_km`,
      [center.location.coordinates[0], center.location.coordinates[1], lng, lat],
    );
    return parseFloat(result[0].distance_km);
  }
}
