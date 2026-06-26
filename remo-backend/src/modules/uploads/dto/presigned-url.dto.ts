import { IsEnum, IsString, Matches } from 'class-validator';

export enum UploadType {
  DNI_FRONT = 'dni_front',
  DNI_BACK = 'dni_back',
  SELFIE = 'selfie',
  LICENSE = 'license',
  MUNICIPAL_PERMIT = 'municipal_permit',
  VTV = 'vtv',
  INSURANCE = 'insurance',
  AVATAR = 'avatar',
}

export class PresignedUrlDto {
  @IsEnum(UploadType)
  type: UploadType;

  @IsString()
  @Matches(/^(jpg|jpeg|png|pdf|webp)$/, {
    message: 'Extensión no permitida. Usar: jpg, jpeg, png, pdf, webp',
  })
  ext: string;
}
