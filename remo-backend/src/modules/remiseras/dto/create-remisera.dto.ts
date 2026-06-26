import { IsEmail, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateRemeseraDto {
  @IsString()
  @MaxLength(150)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(13)
  cuit?: string;

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

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(50)
  commissionPct?: number;
}
