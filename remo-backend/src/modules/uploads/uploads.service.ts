import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { UploadType } from './dto/presigned-url.dto';

const PRESIGNED_TTL = 300; // 5 minutos

const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
};

@Injectable()
export class UploadsService implements OnModuleInit {
  private readonly logger = new Logger(UploadsService.name);
  private client: S3Client;
  private bucket: string;
  private publicBaseUrl: string;

  constructor(private config: ConfigService) {}

  async onModuleInit() {
    const endpoint = this.config.get<string>('storage.endpoint')!;
    const port = this.config.get<number>('storage.port')!;
    const useSSL = this.config.get<boolean>('storage.useSSL')!;
    const accessKey = this.config.get<string>('storage.accessKey')!;
    const secretKey = this.config.get<string>('storage.secretKey')!;
    this.bucket = this.config.get<string>('storage.bucket')!;

    const protocol = useSSL ? 'https' : 'http';
    const endpointUrl = `${protocol}://${endpoint}:${port}`;

    this.publicBaseUrl =
      this.config.get<string>('storage.publicUrl') || `${endpointUrl}/${this.bucket}`;

    this.client = new S3Client({
      endpoint: endpointUrl,
      region: 'us-east-1', // requerido por el SDK, MinIO lo ignora
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
      forcePathStyle: true, // MinIO requiere path-style: endpoint/bucket/key
    });

    await this.ensureBucketExists();
  }

  // ─── Crea el bucket si no existe (útil en dev) ────────────────────────────────

  private async ensureBucketExists() {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`Bucket "${this.bucket}" listo`);
    } catch {
      try {
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.logger.log(`Bucket "${this.bucket}" creado`);
      } catch (err: any) {
        this.logger.error(`No se pudo crear el bucket: ${err.message}`);
      }
    }
  }

  // ─── Genera presigned URL ─────────────────────────────────────────────────────

  async getPresignedUrl(
    userId: string,
    type: UploadType,
    ext: string,
  ): Promise<{ uploadUrl: string; fileUrl: string; expiresIn: number }> {
    const key = this.buildKey(userId, type, ext);
    const contentType = CONTENT_TYPES[ext.toLowerCase()] ?? 'application/octet-stream';

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: PRESIGNED_TTL });
    const fileUrl = `${this.publicBaseUrl}/${key}`;

    return { uploadUrl, fileUrl, expiresIn: PRESIGNED_TTL };
  }

  // ─── Nomenclatura de keys ─────────────────────────────────────────────────────

  private buildKey(userId: string, type: UploadType, ext: string): string {
    const uuid = randomUUID();
    if (type === UploadType.AVATAR) {
      return `avatars/${userId}/${uuid}.${ext}`;
    }
    return `drivers/${userId}/${type}/${uuid}.${ext}`;
  }
}
