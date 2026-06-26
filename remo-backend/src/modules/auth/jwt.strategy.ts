import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { User, UserStatus } from '../users/entities/user.entity';
import { TokenPayload } from './token.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @InjectRepository(User) private userRepository: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get<string>('jwt.accessSecret')!,
      ignoreExpiration: false,
    });
  }

  async validate(payload: TokenPayload): Promise<TokenPayload> {
    const user = await this.userRepository.findOne({ where: { id: payload.sub } });

    if (!user || user.status === UserStatus.SUSPENDED || user.status === UserStatus.BANNED) {
      throw new UnauthorizedException('Cuenta inactiva o suspendida');
    }

    return payload;
  }
}
