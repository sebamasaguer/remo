import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Trip } from './entities/trip.entity';
import { TripLocation } from './entities/trip-location.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';
import { MatchingService } from './matching.service';
import { FaresModule } from '../fares/fares.module';
import { GatewayModule } from '../../gateway/gateway.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Trip, TripLocation, Driver]),
    FaresModule,
    GatewayModule,
  ],
  controllers: [TripsController],
  providers: [TripsService, MatchingService],
  exports: [TripsService, MatchingService],
})
export class TripsModule {}
