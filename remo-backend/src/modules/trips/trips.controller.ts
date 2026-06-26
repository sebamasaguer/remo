import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TripsService } from './trips.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { TokenPayload } from '../auth/token.service';
import { CreateTripDto } from './dto/create-trip.dto';
import { EstimateTripDto } from './dto/estimate-trip.dto';
import { CancelTripDto } from './dto/cancel-trip.dto';

@Controller('trips')
@UseGuards(JwtAuthGuard)
export class TripsController {
  constructor(private tripsService: TripsService) {}

  @Post('estimate')
  @HttpCode(HttpStatus.OK)
  estimate(@Body() dto: EstimateTripDto) {
    return this.tripsService.estimate(dto);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: TokenPayload, @Body() dto: CreateTripDto) {
    return this.tripsService.create(user.sub, dto);
  }

  @Get('history')
  getHistory(
    @CurrentUser() user: TokenPayload,
    @Query('as') as: 'driver' | 'passenger' = 'passenger',
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 20,
  ) {
    return this.tripsService.getHistory(user.sub, as === 'driver', page, limit);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.tripsService.findById(id);
  }

  // Acciones del conductor
  @Patch(':id/arrived')
  driverArrived(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: TokenPayload) {
    return this.tripsService.driverArrived(user.sub, id);
  }

  @Patch(':id/start')
  startTrip(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: TokenPayload) {
    return this.tripsService.startTrip(user.sub, id);
  }

  @Patch(':id/complete')
  completeTrip(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: TokenPayload) {
    return this.tripsService.completeTrip(user.sub, id);
  }

  // Cancelación
  @Patch(':id/cancel/passenger')
  cancelByPassenger(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: TokenPayload,
    @Body() dto: CancelTripDto,
  ) {
    return this.tripsService.cancelByPassenger(user.sub, id, dto);
  }

  @Patch(':id/cancel/driver')
  cancelByDriver(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: TokenPayload,
    @Body() dto: CancelTripDto,
  ) {
    return this.tripsService.cancelByDriver(user.sub, id, dto);
  }

  // Dev-only: simula que el conductor de prueba acepta el viaje
  @Post(':id/dev-accept')
  devAccept(@Param('id', ParseUUIDPipe) id: string) {
    const TEST_DRIVER_ID = '41ab0532-42f9-4ecd-ae15-dafca36b72cf';
    return this.tripsService.devAcceptTrip(id, TEST_DRIVER_ID);
  }
}
