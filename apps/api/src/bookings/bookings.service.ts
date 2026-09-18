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
import { PickupPointsService } from '../centers/pickup-points.service';
import { TestsService } from '../catalog/tests.service';
import { PackagesService } from '../catalog/packages.service';

interface PricedItem {
  testId?: string;
  packageId?: string;
  price: number;
}

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
  ) {}

  async create(customerId: string, dto: CreateBookingDto): Promise<Booking> {
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

    const scheduledAt = new Date(dto.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() < Date.now()) {
      throw new BadRequestException('scheduledAt must be a valid future date/time');
    }

    const items = await this.priceItems(dto.items);
    const totalAmount = items.reduce((sum, item) => sum + item.price, 0);

    return this.dataSource.transaction(async (manager) => {
      const booking = manager.create(Booking, {
        customerId,
        centerId: dto.centerId,
        pickupPointId:
          dto.collectionMode === CollectionMode.PICKUP_POINT ? dto.pickupPointId : undefined,
        collectionMode: dto.collectionMode,
        scheduledAt,
        status: BookingStatus.PENDING,
        totalAmount,
      });
      const savedBooking = await manager.save(booking);

      const bookingItems = items.map((item) =>
        manager.create(BookingItem, { bookingId: savedBooking.id, ...item }),
      );
      savedBooking.items = await manager.save(BookingItem, bookingItems);
      return savedBooking;
    });
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

  findAllForCustomer(customerId: string): Promise<Booking[]> {
    return this.bookingsRepo.find({
      where: { customerId },
      relations: ['items'],
      order: { createdAt: 'DESC' },
    });
  }

  findAll(): Promise<Booking[]> {
    return this.bookingsRepo.find({ relations: ['items'], order: { createdAt: 'DESC' } });
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
    return this.bookingsRepo.save(booking);
  }

  async updateStatus(id: string, dto: UpdateBookingStatusDto): Promise<Booking> {
    const booking = await this.findOne(id);
    booking.status = dto.status;
    return this.bookingsRepo.save(booking);
  }
}
