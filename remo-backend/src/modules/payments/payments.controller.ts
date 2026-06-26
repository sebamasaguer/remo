import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { TokenPayload } from '../auth/token.service';

@Controller('payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Get(':tripId')
  @UseGuards(JwtAuthGuard)
  findByTrip(@Param('tripId', ParseUUIDPipe) tripId: string) {
    return this.paymentsService.findByTrip(tripId);
  }

  @Patch(':tripId/confirm-cash')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  confirmCash(
    @Param('tripId', ParseUUIDPipe) tripId: string,
    @CurrentUser() user: TokenPayload,
  ) {
    return this.paymentsService.confirmCash(tripId, user.sub);
  }

  // Webhook de Mercado Pago — sin autenticación JWT, es llamado por MP
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-signature') signature: string,
    @Body() payload: any,
  ) {
    const rawBody = req.rawBody?.toString() ?? JSON.stringify(payload);
    await this.paymentsService.handleWebhook(payload, signature, rawBody);
    return { received: true };
  }
}
