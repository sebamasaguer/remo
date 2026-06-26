import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class UpdateVehicleDto {
  @IsString()
  @IsOptional()
  @MaxLength(50)
  brand?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  model?: string;

  @IsString()
  @IsOptional()
  @Matches(/^\d{4}$/, { message: 'Año inválido' })
  year?: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  color?: string;

  @IsString()
  @IsOptional()
  photoUrl?: string;
}
