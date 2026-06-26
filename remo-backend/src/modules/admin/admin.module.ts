import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { Trip } from '../trips/entities/trip.entity';
import { FareConfig } from '../fares/entities/fare-config.entity';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Driver, Trip, FareConfig])],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
