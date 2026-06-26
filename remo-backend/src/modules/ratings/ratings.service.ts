import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Rating } from './entities/rating.entity';
import { User } from '../users/entities/user.entity';
import { Trip, TripStatus } from '../trips/entities/trip.entity';
import { CreateRatingDto } from './dto/create-rating.dto';

@Injectable()
export class RatingsService {
  constructor(
    @InjectRepository(Rating)
    private ratingRepository: Repository<Rating>,

    @InjectRepository(Trip)
    private tripRepository: Repository<Trip>,

    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async create(fromUserId: string, dto: CreateRatingDto): Promise<Rating> {
    const trip = await this.tripRepository.findOne({
      where: { id: dto.tripId },
      relations: ['passenger', 'driver', 'driver.user'],
    });

    if (!trip) throw new NotFoundException('Viaje no encontrado');

    if (trip.status !== TripStatus.COMPLETED) {
      throw new BadRequestException('Solo podés calificar viajes completados');
    }

    // Determina quién califica a quién
    let toUserId: string;

    if (trip.passengerId === fromUserId) {
      // Pasajero califica al conductor
      if (!trip.driverId || !trip.driver?.userId) {
        throw new BadRequestException('El viaje no tiene conductor asignado');
      }
      toUserId = trip.driver.userId;
    } else if (trip.driver?.userId === fromUserId) {
      // Conductor califica al pasajero
      toUserId = trip.passengerId;
    } else {
      throw new BadRequestException('No participaste en este viaje');
    }

    // Verifica que no haya calificado ya
    const existing = await this.ratingRepository.findOne({
      where: { tripId: dto.tripId, fromUserId },
    });

    if (existing) {
      throw new ConflictException('Ya calificaste este viaje');
    }

    if (dto.score < 1 || dto.score > 5) {
      throw new BadRequestException('La calificación debe ser entre 1 y 5');
    }

    const rating = this.ratingRepository.create({
      tripId: dto.tripId,
      fromUserId,
      toUserId,
      score: dto.score,
      comment: dto.comment,
    });

    await this.ratingRepository.save(rating);

    // Recalcula el promedio del usuario calificado
    await this.recalculateAverage(toUserId);

    return rating;
  }

  async getMyRatings(userId: string, page = 1, limit = 20) {
    const [items, total] = await this.ratingRepository.findAndCount({
      where: { toUserId: userId },
      relations: ['fromUser', 'trip'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { items, total, page, limit };
  }

  private async recalculateAverage(userId: string): Promise<void> {
    const result = await this.ratingRepository
      .createQueryBuilder('rating')
      .select('AVG(rating.score)', 'avg')
      .addSelect('COUNT(rating.id)', 'count')
      .where('rating.to_user_id = :userId', { userId })
      .getRawOne();

    await this.userRepository.update(userId, {
      ratingAvg: parseFloat(parseFloat(result.avg).toFixed(1)),
      ratingCount: parseInt(result.count, 10),
    });
  }
}
