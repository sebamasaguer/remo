import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, UseGuards } from '@nestjs/common';
import { RatingsService } from './ratings.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { TokenPayload } from '../auth/token.service';
import { CreateRatingDto } from './dto/create-rating.dto';

@Controller('ratings')
@UseGuards(JwtAuthGuard)
export class RatingsController {
  constructor(private ratingsService: RatingsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: TokenPayload, @Body() dto: CreateRatingDto) {
    return this.ratingsService.create(user.sub, dto);
  }

  @Get('me')
  getMyRatings(
    @CurrentUser() user: TokenPayload,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.ratingsService.getMyRatings(user.sub, +page, +limit);
  }
}
