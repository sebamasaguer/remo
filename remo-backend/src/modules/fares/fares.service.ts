import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FareConfig } from './entities/fare-config.entity';

export interface PriceEstimate {
  distanceKm: number;
  durationMin: number;
  price: number;
  baseFare: number;
  platformCommissionPct: number;
}

@Injectable()
export class FaresService {
  constructor(
    @InjectRepository(FareConfig)
    private fareRepository: Repository<FareConfig>,
  ) {}

  async estimate(distanceKm: number, durationMin: number): Promise<PriceEstimate> {
    const fare = await this.fareRepository.findOne({ where: { isActive: true } });

    if (!fare) throw new NotFoundException('No hay configuración tarifaria activa');

    const price = Math.ceil(
      Number(fare.baseFare) +
      distanceKm * Number(fare.pricePerKm) +
      durationMin * Number(fare.pricePerMin),
    );

    return {
      distanceKm,
      durationMin,
      price,
      baseFare: Number(fare.baseFare),
      platformCommissionPct: Number(fare.platformCommissionPct),
    };
  }

  async getActive(): Promise<FareConfig> {
    const fare = await this.fareRepository.findOne({ where: { isActive: true } });
    if (!fare) throw new NotFoundException('No hay configuración tarifaria activa');
    return fare;
  }
}
