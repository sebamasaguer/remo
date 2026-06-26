import { IsString, Matches } from 'class-validator';

export class RequestOtpDto {
  @IsString()
  @Matches(/^\+?[1-9]\d{7,14}$/, { message: 'Número de teléfono inválido' })
  phone: string;
}
