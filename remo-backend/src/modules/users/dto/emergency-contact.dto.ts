import { IsString, Length, Matches, MaxLength } from 'class-validator';

export class CreateEmergencyContactDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsString()
  @Matches(/^\+?[1-9]\d{7,14}$/, { message: 'Número de teléfono inválido' })
  phone: string;
}
