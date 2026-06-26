import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { TokenPayload } from '../auth/token.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateFcmTokenDto } from './dto/update-fcm-token.dto';
import { CreateEmergencyContactDto } from './dto/emergency-contact.dto';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  getProfile(@CurrentUser() user: TokenPayload) {
    return this.usersService.findById(user.sub);
  }

  @Patch('me')
  updateProfile(@CurrentUser() user: TokenPayload, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.sub, dto);
  }

  @Patch('me/fcm-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  updateFcmToken(@CurrentUser() user: TokenPayload, @Body() dto: UpdateFcmTokenDto) {
    return this.usersService.updateFcmToken(user.sub, dto);
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteAccount(@CurrentUser() user: TokenPayload) {
    return this.usersService.deleteAccount(user.sub);
  }

  @Get('me/emergency-contacts')
  getEmergencyContacts(@CurrentUser() user: TokenPayload) {
    return this.usersService.getEmergencyContacts(user.sub);
  }

  @Post('me/emergency-contacts')
  @HttpCode(HttpStatus.CREATED)
  addEmergencyContact(
    @CurrentUser() user: TokenPayload,
    @Body() dto: CreateEmergencyContactDto,
  ) {
    return this.usersService.addEmergencyContact(user.sub, dto);
  }

  @Delete('me/emergency-contacts/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeEmergencyContact(
    @CurrentUser() user: TokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.usersService.removeEmergencyContact(user.sub, id);
  }
}
