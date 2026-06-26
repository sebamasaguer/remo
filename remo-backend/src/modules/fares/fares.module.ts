import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FareConfig } from './entities/fare-config.entity';
import { FaresService } from './fares.service';

@Module({
  imports: [TypeOrmModule.forFeature([FareConfig])],
  providers: [FaresService],
  exports: [FaresService],
})
export class FaresModule {}
