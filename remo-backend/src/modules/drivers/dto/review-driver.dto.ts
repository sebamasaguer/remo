import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum ReviewAction {
  APPROVE = 'approve',
  REJECT = 'reject',
  SUSPEND = 'suspend',
}

export class ReviewDriverDto {
  @IsEnum(ReviewAction)
  action: ReviewAction;

  @IsString()
  @IsOptional()
  reason?: string; // requerido si action = reject o suspend
}
