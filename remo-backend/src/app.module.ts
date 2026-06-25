import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';
import redisConfig from './config/redis.config';

import { RedisModule } from './redis/redis.module';

import { User } from './modules/users/entities/user.entity';
import { Driver } from './modules/drivers/entities/driver.entity';
import { Vehicle } from './modules/drivers/entities/vehicle.entity';
import { DriverDocument } from './modules/drivers/entities/driver-document.entity';
import { Remisera } from './modules/remiseras/entities/remisera.entity';
import { Trip } from './modules/trips/entities/trip.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, jwtConfig, redisConfig],
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('database.host'),
        port: config.get<number>('database.port'),
        database: config.get('database.name'),
        username: config.get('database.user'),
        password: config.get('database.pass'),
        entities: [User, Driver, Vehicle, DriverDocument, Remisera, Trip],
        synchronize: config.get('app.nodeEnv') === 'development',
        logging: config.get('app.nodeEnv') === 'development',
      }),
    }),

    RedisModule,
  ],
})
export class AppModule {}
