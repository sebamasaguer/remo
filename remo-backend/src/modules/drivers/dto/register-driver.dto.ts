import { IsEnum, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { DriverType } from '../entities/driver.entity';

export class RegisterDriverDto {
  @IsEnum(DriverType)
  type: DriverType;

  @IsUUID()
  @IsOptional()
  remiseraId?: string; // obligatorio si type = 'remisera'

  // Vehículo
  @IsString()
  @Matches(/^[A-Z0-9]{6,7}$/, { message: 'Patente inválida' })
  plate: string;

  @IsString()
  @MaxLength(50)
  brand: string;

  @IsString()
  @MaxLength(50)
  model: string;

  @IsString()
  @Matches(/^\d{4}$/, { message: 'Año inválido' })
  year: string;

  @IsString()
  @MaxLength(30)
  color: string;
}
