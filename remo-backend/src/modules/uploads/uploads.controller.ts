import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UploadsService } from './uploads.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { TokenPayload } from '../auth/token.service';
import { PresignedUrlDto } from './dto/presigned-url.dto';

@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadsController {
  constructor(private uploadsService: UploadsService) {}

  /**
   * GET /api/v1/uploads/presigned?type=license&ext=jpg
   *
   * Devuelve:
   *   uploadUrl  → URL firmada para hacer PUT directo a MinIO/S3 (expira en 5 min)
   *   fileUrl    → URL pública del archivo una vez subido (guardar en DB)
   *   expiresIn  → segundos de validez del uploadUrl
   *
   * Flujo en el cliente:
   *   1. GET /uploads/presigned?type=license&ext=jpg
   *   2. PUT uploadUrl (con el archivo en el body, Content-Type: image/jpeg)
   *   3. POST /drivers/me/documents { type: 'license', fileUrl }
   */
  @Get('presigned')
  getPresignedUrl(
    @CurrentUser() user: TokenPayload,
    @Query() query: PresignedUrlDto,
  ) {
    return this.uploadsService.getPresignedUrl(user.sub, query.type, query.ext);
  }
}
