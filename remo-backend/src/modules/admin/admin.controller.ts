import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { TokenPayload } from '../auth/token.service';
import { UserRole, UserStatus } from '../users/entities/user.entity';
import { TripStatus } from '../trips/entities/trip.entity';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpsertFareConfigDto } from './dto/upsert-fare-config.dto';
import { ReviewDriverDto } from '../drivers/dto/review-driver.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private adminService: AdminService) {}

  // ─── Dashboard ────────────────────────────────────────────────────────────────

  @Get('stats')
  getStats() {
    return this.adminService.getDashboardStats();
  }

  // ─── Usuarios ─────────────────────────────────────────────────────────────────

  @Get('users')
  listUsers(
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 50,
    @Query('status') status?: UserStatus,
  ) {
    return this.adminService.listUsers(page, limit, status);
  }

  @Get('users/:id')
  getUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getUser(id);
  }

  @Patch('users/:id/status')
  updateUserStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.adminService.updateUserStatus(id, dto);
  }

  // ─── Conductores independientes ───────────────────────────────────────────────

  @Get('drivers/pending')
  listPendingDrivers() {
    return this.adminService.listPendingIndependentDrivers();
  }

  @Get('drivers/:id')
  getDriver(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getDriver(id);
  }

  @Patch('drivers/:id/review')
  reviewDriver(
    @CurrentUser() user: TokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewDriverDto,
  ) {
    return this.adminService.reviewIndependentDriver(user.sub, id, dto);
  }

  // ─── Viajes ───────────────────────────────────────────────────────────────────

  @Get('trips')
  listTrips(
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 50,
    @Query('status') status?: TripStatus,
  ) {
    return this.adminService.listTrips(page, limit, status);
  }

  @Get('trips/:id')
  getTrip(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getTrip(id);
  }

  // ─── Tarifas ──────────────────────────────────────────────────────────────────

  @Get('fares')
  getFareConfig() {
    return this.adminService.getFareConfig();
  }

  @Put('fares')
  upsertFareConfig(@Body() dto: UpsertFareConfigDto) {
    return this.adminService.upsertFareConfig(dto);
  }
}
