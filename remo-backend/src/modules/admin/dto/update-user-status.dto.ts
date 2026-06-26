import { IsEnum, IsOptional, IsString } from 'class-validator';
import { UserStatus } from '../../../modules/users/entities/user.entity';

export class UpdateUserStatusDto {
  @IsEnum(UserStatus)
  status: UserStatus;

  @IsString()
  @IsOptional()
  reason?: string;
}
