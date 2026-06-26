import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DriversService } from './drivers.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { TokenPayload } from '../auth/token.service';
import { RegisterDriverDto } from './dto/register-driver.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { ReviewDriverDto } from './dto/review-driver.dto';

@Controller('drivers')
@UseGuards(JwtAuthGuard)
export class DriversController {
  constructor(private driversService: DriversService) {}

  // ─── Conductor autenticado ────────────────────────────────────────────────────

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@CurrentUser() user: TokenPayload, @Body() dto: RegisterDriverDto) {
    return this.driversService.register(user.sub, dto);
  }

  @Get('me')
  getProfile(@CurrentUser() user: TokenPayload) {
    return this.driversService.findByUserId(user.sub);
  }

  @Patch('me/vehicle')
  updateVehicle(@CurrentUser() user: TokenPayload, @Body() dto: UpdateVehicleDto) {
    return this.driversService.updateVehicle(user.sub, dto);
  }

  @Post('me/location')
  @HttpCode(HttpStatus.NO_CONTENT)
  updateLocation(@CurrentUser() user: TokenPayload, @Body() dto: UpdateLocationDto) {
    return this.driversService.updateLocation(user.sub, dto);
  }

  @Patch('me/status')
  updateStatus(@CurrentUser() user: TokenPayload, @Body() dto: UpdateStatusDto) {
    return this.driversService.updateOnlineStatus(user.sub, dto);
  }

  @Get('me/documents')
  getDocuments(@CurrentUser() user: TokenPayload) {
    return this.driversService.getDocuments(user.sub);
  }

  @Post('me/documents')
  @HttpCode(HttpStatus.CREATED)
  uploadDocument(@CurrentUser() user: TokenPayload, @Body() dto: UploadDocumentDto) {
    return this.driversService.uploadDocument(user.sub, dto);
  }

  @Get('me/earnings')
  getEarnings(
    @CurrentUser() user: TokenPayload,
    @Query('period') period: 'day' | 'week' | 'month' = 'day',
  ) {
    return this.driversService.getEarnings(user.sub, period);
  }

  // ─── Admin / Remisera ─────────────────────────────────────────────────────────

  @Get('pending')
  findPending() {
    return this.driversService.findPending();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.driversService.findById(id);
  }

  @Patch(':id/review')
  reviewDriver(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: TokenPayload,
    @Body() dto: ReviewDriverDto,
  ) {
    return this.driversService.reviewDriver(id, user.sub, dto);
  }
}
