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
import { RemeserasService } from './remiseras.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { TokenPayload } from '../auth/token.service';
import { CreateRemeseraDto } from './dto/create-remisera.dto';
import { UpdateRemeseraDto } from './dto/update-remisera.dto';
import { ReviewDriverDto } from '../drivers/dto/review-driver.dto';

@Controller('remiseras')
@UseGuards(JwtAuthGuard)
export class RemeserasController {
  constructor(private remeserasService: RemeserasService) {}

  // ─── Panel de la remisera (remisera_admin) ────────────────────────────────────

  @Get('me')
  getMyRemisera(@CurrentUser() user: TokenPayload) {
    return this.remeserasService.getMyRemisera(user.sub);
  }

  @Patch('me')
  updateMyRemisera(@CurrentUser() user: TokenPayload, @Body() dto: UpdateRemeseraDto) {
    return this.remeserasService.updateMyRemisera(user.sub, dto);
  }

  @Get('me/drivers')
  getFleet(@CurrentUser() user: TokenPayload) {
    return this.remeserasService.getFleet(user.sub);
  }

  @Get('me/drivers/:id')
  getFleetDriver(
    @CurrentUser() user: TokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.remeserasService.getFleetDriver(user.sub, id);
  }

  @Patch('me/drivers/:id/review')
  reviewFleetDriver(
    @CurrentUser() user: TokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewDriverDto,
  ) {
    return this.remeserasService.reviewFleetDriver(user.sub, id, dto);
  }

  @Get('me/trips')
  getFleetTrips(
    @CurrentUser() user: TokenPayload,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 30,
  ) {
    return this.remeserasService.getFleetTrips(user.sub, page, limit);
  }

  @Get('me/reports/earnings')
  getEarningsReport(
    @CurrentUser() user: TokenPayload,
    @Query('period') period: 'day' | 'week' | 'month' = 'month',
  ) {
    return this.remeserasService.getEarningsReport(user.sub, period);
  }

  // ─── Admin REMO: gestión de remiseras ────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateRemeseraDto) {
    return this.remeserasService.create(dto);
  }

  @Get()
  findAll() {
    return this.remeserasService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.remeserasService.findById(id);
  }

  @Patch(':id')
  updateOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRemeseraDto,
  ) {
    return this.remeserasService.updateById(id, dto);
  }

  @Post(':id/admins/:userId')
  @HttpCode(HttpStatus.CREATED)
  addAdmin(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.remeserasService.addAdmin(id, userId);
  }
}
