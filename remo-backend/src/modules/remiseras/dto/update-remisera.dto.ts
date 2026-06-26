import { IsEmail, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UpdateRemeseraDto {
  @IsString()
  @IsOptional()
  @MaxLength(150)
  name?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  phone?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  logoUrl?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(50)
  commissionPct?: number;
}
