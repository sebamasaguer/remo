import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserStatus } from '../users/entities/user.entity';
import { OtpService } from './otp.service';
import { TokenService, AuthTokens } from './token.service';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private otpService: OtpService,
    private tokenService: TokenService,
  ) {}

  async requestOtp(dto: RequestOtpDto): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({ where: { phone: dto.phone } });

    if (user?.status === UserStatus.BANNED) {
      throw new BadRequestException('Esta cuenta está bloqueada');
    }

    await this.otpService.sendOtp(dto.phone);

    return { message: 'Código enviado al número indicado' };
  }

  async verifyOtp(dto: VerifyOtpDto): Promise<AuthTokens & { isNewUser: boolean }> {
    const valid = await this.otpService.verifyOtp(dto.phone, dto.code);

    if (!valid) {
      throw new UnauthorizedException('Código inválido, expirado o demasiados intentos');
    }

    let user = await this.userRepository.findOne({ where: { phone: dto.phone } });
    const isNewUser = !user;

    if (!user) {
      user = this.userRepository.create({ phone: dto.phone });
      await this.userRepository.save(user);
    }

    const tokens = await this.tokenService.generateTokens({
      sub: user.id,
      phone: user.phone,
      role: user.role,
    });

    return { ...tokens, isNewUser };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    return this.tokenService.refreshTokens(refreshToken);
  }

  async logout(userId: string): Promise<{ message: string }> {
    await this.tokenService.revokeRefreshToken(userId);
    return { message: 'Sesión cerrada correctamente' };
  }
}
