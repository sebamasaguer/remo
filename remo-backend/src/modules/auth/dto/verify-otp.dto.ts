import { IsString, Length, Matches } from 'class-validator';

export class VerifyOtpDto {
  @IsString()
  @Matches(/^\+?[1-9]\d{7,14}$/, { message: 'Número de teléfono inválido' })
  phone: string;

  @IsString()
  @Length(6, 6, { message: 'El código debe tener 6 dígitos' })
  @Matches(/^\d{6}$/, { message: 'El código debe ser numérico' })
  code: string;
}
