import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';
import redisConfig from './config/redis.config';
import firebaseConfig from './config/firebase.config';

import { RedisModule } from './redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { DriversModule } from './modules/drivers/drivers.module';
import { TripsModule } from './modules/trips/trips.module';
import { FaresModule } from './modules/fares/fares.module';
import { GatewayModule } from './gateway/gateway.module';
import { RatingsModule } from './modules/ratings/ratings.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { UsersModule } from './modules/users/users.module';
import { RemeserasModule } from './modules/remiseras/remiseras.module';
import { AdminModule } from './modules/admin/admin.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

import { User } from './modules/users/entities/user.entity';
import { Driver } from './modules/drivers/entities/driver.entity';
import { Vehicle } from './modules/drivers/entities/vehicle.entity';
import { DriverDocument } from './modules/drivers/entities/driver-document.entity';
import { Remisera } from './modules/remiseras/entities/remisera.entity';
import { Trip } from './modules/trips/entities/trip.entity';
import { TripLocation } from './modules/trips/entities/trip-location.entity';
import { FareConfig } from './modules/fares/entities/fare-config.entity';
import { Rating } from './modules/ratings/entities/rating.entity';
import { Payment } from './modules/payments/entities/payment.entity';
import { EmergencyContact } from './modules/users/entities/emergency-contact.entity';
import { RemeseraAdmin } from './modules/remiseras/entities/remisera-admin.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, jwtConfig, redisConfig, firebaseConfig],
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
        entities: [
          User, Driver, Vehicle, DriverDocument,
          Remisera, Trip, TripLocation, FareConfig,
          Rating, Payment,
          EmergencyContact, RemeseraAdmin,
        ],
        synchronize: config.get('app.nodeEnv') === 'development',
        logging: config.get('app.nodeEnv') === 'development',
      }),
    }),

    RedisModule,
    NotificationsModule,
    GatewayModule,
    AuthModule,
    DriversModule,
    FaresModule,
    TripsModule,
    UsersModule,
    RemeserasModule,
    AdminModule,
    RatingsModule,
    PaymentsModule,
  ],
})
export class AppModule {}
