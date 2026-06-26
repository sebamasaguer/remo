import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { DocumentType } from '../entities/driver-document.entity';

export class UploadDocumentDto {
  @IsEnum(DocumentType)
  type: DocumentType;

  @IsString()
  fileUrl: string;

  @IsDateString()
  @IsOptional()
  expiresAt?: string; // requerido para license, municipal_permit, vtv, insurance
}
