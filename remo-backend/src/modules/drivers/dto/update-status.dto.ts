import { IsBoolean } from 'class-validator';

export class UpdateStatusDto {
  @IsBoolean()
  isOnline: boolean;
}
