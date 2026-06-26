import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Remisera } from './entities/remisera.entity';
import { RemeseraAdmin } from './entities/remisera-admin.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { Trip } from '../trips/entities/trip.entity';
import { User } from '../users/entities/user.entity';
import { RemeserasController } from './remiseras.controller';
import { RemeserasService } from './remiseras.service';

@Module({
  imports: [TypeOrmModule.forFeature([Remisera, RemeseraAdmin, Driver, Trip, User])],
  controllers: [RemeserasController],
  providers: [RemeserasService],
  exports: [RemeserasService],
})
export class RemeserasModule {}
