import { IsOptional, IsString } from 'class-validator';

export class CancelTripDto {
  @IsString()
  @IsOptional()
  reason?: string;
}
